import { describe, expect, it } from "vitest";
import {
  FEDERAL_STUDENT_JOBS_SOURCE_ID,
  fetchFederalVacancies,
  parseFederalStudentVacancies,
} from "./vacancies.js";

const page = `
  <h1 property="name">Federal Student Work Experience Program</h1>
  <h2>Specialized inventories</h2>
  <details><summary>Student Border Services Officer (Summer 2027)</summary>
    <li><strong>Organization</strong>: Canada Border Services Agency</li>
    <li><strong>Deadline to apply</strong>: September 17, 2026</li>
    <a href="https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.html?poster=1962&amp;lang=en">Apply</a>
  </details>
  <details><summary>Great Lakes Area Summer Fisheries Student Program - 2027</summary>
    <li><strong>Organization</strong>: Fisheries and Oceans Canada</li>
    <li><strong>Deadline to apply</strong>: October 28, 2026</li>
    <a href="https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.html?poster=2042&amp;lang=en">Apply</a>
  </details>`;

describe("federal student vacancies", () => {
  it("parses stable poster IDs and deadlines from the official page shape", () => {
    expect(
      parseFederalStudentVacancies(page).map(({ posterId, closingDate }) => ({
        posterId,
        closingDate,
      })),
    ).toEqual([
      { posterId: "1962", closingDate: "2026-09-17" },
      { posterId: "2042", closingDate: "2026-10-28" },
    ]);
  });

  it("publishes only unexpired direct official postings with evidence and daily refresh", async () => {
    const fetcher = (async () =>
      new Response(page, {
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const now = new Date("2026-09-26T18:00:00.000Z");
    const result = await fetchFederalVacancies(fetcher, now);
    expect(result.failedSources).toEqual([]);
    expect(result.refreshedSourceIds).toEqual([FEDERAL_STUDENT_JOBS_SOURCE_ID]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: "official-federal-student-job-2042",
      sourceId: FEDERAL_STUDENT_JOBS_SOURCE_ID,
      externalId: "2042",
      title: "Great Lakes Area Summer Fisheries Student Program - 2027",
      sourceUrl:
        "https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.html?poster=2042&lang=en",
      evidenceUrl:
        "https://www.canada.ca/en/public-service-commission/jobs/services/recruitment/students/federal-student-work-program.html",
      listing: {
        category: "job",
        postedDate: null,
        closingDate: "2026-10-28",
        locationText: null,
        applicationStatus: "open",
      },
      registry: { collectionMode: "official_link" },
      expiresAt: "2026-09-27T18:00:00.000Z",
    });
    expect(result.records[0]?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a changed structure and an off-host application link", async () => {
    const badLink = page.replace(
      "emploisfp-psjobs.cfp-psc.gc.ca",
      "other.example",
    );
    const fetcher = (async () =>
      new Response(badLink, {
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const result = await fetchFederalVacancies(fetcher);
    expect(result.records).toEqual([]);
    expect(result.refreshedSourceIds).toEqual([]);
    expect(result.failedSources).toEqual([
      { sourceId: FEDERAL_STUDENT_JOBS_SOURCE_ID, code: "LISTING_URL_CHANGED" },
    ]);
    expect(() =>
      parseFederalStudentVacancies("<h1>Access denied</h1>"),
    ).toThrow();
  });
});
