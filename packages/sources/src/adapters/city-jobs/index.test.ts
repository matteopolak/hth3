import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CITY_JOB_SOURCES,
  fetchCityVacancies,
  parsePosting,
  parseSearchLinks,
} from "./index.js";

const ottawa = CITY_JOB_SOURCES[0]!;
const toronto = CITY_JOB_SOURCES[1]!;
const now = new Date("2026-09-26T14:00:00.000Z");

describe("public municipal vacancy parser", () => {
  it("accepts official current-job links only", () => {
    const search = `<a href="/city-jobs/job/Ottawa-Role-ON/1291413247/" class="jobTitle-link">Role</a>
      <a href="/city-jobs/job/Ottawa-Role-ON/1291413247/" class="jobTitle-link">Role</a>
      <a href="https://elsewhere.example/job/Role/123/" class="jobTitle-link">Other</a>`;
    expect(parseSearchLinks(search, ottawa)).toEqual([
      "https://jobs-emplois.ottawa.ca/city-jobs/job/Ottawa-Role-ON/1291413247/",
    ]);
  });

  it("requires Ottawa's publisher ID, address and explicit application close", () => {
    const html = `<div itemtype="http://schema.org/JobPosting"><meta itemprop="datePosted" content="Fri Sep 25 02:00:00 UTC 2026"><span itemprop="title">Bus Operator</span><span itemprop="description"><p>Requisition ID: 23262<br>Location: 2475 Don Reid Drive<br>Application Close: 31/03/2027</p></span></div>`;
    expect(parsePosting(html, ottawa, now)).toEqual({
      publisherId: "23262",
      title: "Bus Operator",
      postedDate: "2026-09-25",
      closingDate: "2027-03-31",
      locationText: "2475 Don Reid Drive",
    });
    expect(
      parsePosting(html.replace("31/03/2027", "31/02/2027"), ottawa, now),
    ).toBeNull();
  });

  it("requires Toronto's explicit posting period and work location", () => {
    const html = `<div itemtype="http://schema.org/JobPosting"><span itemprop="title">Planner</span><span itemprop="description"><ul><li><strong>Job ID:</strong> 66371</li><li><strong>Work Location:</strong> Metro Hall, Toronto</li><li><strong>Posting Period:</strong> 25-Sep-2026 to 11-Oct-2026</li></ul></span></div>`;
    expect(parsePosting(html, toronto, now)).toEqual({
      publisherId: "66371",
      title: "Planner",
      postedDate: "2026-09-25",
      closingDate: "2026-10-11",
      locationText: "Metro Hall, Toronto",
    });
    expect(
      parsePosting(
        html.replace("11-Oct-2026", "25-Sep-2026"),
        toronto,
        new Date("2026-09-27T14:00:00Z"),
      ),
    ).toBeNull();
  });

  it("returns direct vacancies and both successful source IDs", async () => {
    const pages = new Map([
      [
        ottawa.searchUrl,
        `<a href="/city-jobs/job/Ottawa-Role-ON/1291413247/" class="jobTitle-link">Role</a>`,
      ],
      [
        "https://jobs-emplois.ottawa.ca/city-jobs/job/Ottawa-Role-ON/1291413247/",
        `<div itemtype="http://schema.org/JobPosting"><span itemprop="title">Bus Operator</span><span itemprop="description"><p>Requisition ID: 23262<br>Location: 2475 Don Reid Drive<br>Application Close: 31/03/2027</p></span></div>`,
      ],
      [toronto.searchUrl, `jobRecordsFound: parseInt("0")`],
    ]);
    const fetcher = (async (input: RequestInfo | URL) => {
      const page = pages.get(String(input));
      return new Response(page ?? "", {
        status: page === undefined ? 404 : 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;
    const result = await fetchCityVacancies(fetcher, now);
    expect(result.failedSources).toEqual([]);
    expect(result.refreshedSourceIds).toEqual([
      ottawa.sourceId,
      toronto.sourceId,
    ]);
    expect(result.records).toMatchObject([
      {
        externalId: "23262",
        sourceUrl:
          "https://jobs-emplois.ottawa.ca/city-jobs/job/Ottawa-Role-ON/1291413247/",
        listing: {
          category: "job",
          closingDate: "2027-03-31",
          applicationStatus: "open",
        },
      },
    ]);
  });

  it.skipIf(!process.env.CITY_JOBS_LIVE_FIXTURES)(
    "checks manually captured current pages",
    () => {
      const directory = process.env.CITY_JOBS_LIVE_FIXTURES!;
      expect(
        parseSearchLinks(
          readFileSync(`${directory}/ottawa.html`, "utf8"),
          ottawa,
        ).length,
      ).toBeGreaterThan(0);
      expect(
        parseSearchLinks(
          readFileSync(`${directory}/toronto.html`, "utf8"),
          toronto,
        ).length,
      ).toBeGreaterThan(0);
      expect(
        parsePosting(
          readFileSync(`${directory}/ottawa_detail0.html`, "utf8"),
          ottawa,
          now,
        ),
      ).not.toBeNull();
      expect(
        parsePosting(
          readFileSync(`${directory}/toronto_detail0.html`, "utf8"),
          toronto,
          now,
        ),
      ).not.toBeNull();
    },
  );
});
