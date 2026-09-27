import { describe, expect, it } from "vitest";
import { fetchProvincialVacancies } from "./index.js";

const page = (close: string) => `
  <h1>Job Details</h1><div>BC Public Service</div>
  <div id="job_details_ats_requisition_title">Tree Seed Centre Laborer &ndash; extended</div>
  <div id="job_details_hua_location_id">Surrey, BC CA (Primary)</div>
  <div id="job_details_f_close_date_0">${close}</div>`;

describe("curated BC vacancies", () => {
  it("retains only factual fields from direct posting pages", async () => {
    const fetcher = (async () =>
      new Response(page("10/12/2026"), {
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const result = await fetchProvincialVacancies(
      fetcher,
      new Date("2026-09-26T12:00:00Z"),
    );
    expect(result.failedSources).toEqual([]);
    expect(result.refreshedSourceIds).toEqual(["bc-public-service-vacancies"]);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      externalId: "124147",
      title: "Tree Seed Centre Laborer – extended",
      listing: {
        category: "job",
        locationText: "Surrey, BC CA (Primary)",
        closingDate: "2026-10-12",
        applicationStatus: "open",
      },
    });
  });

  it("fails the source closed when a posting page changes", async () => {
    const fetcher = (async () =>
      new Response("<h1>Sign in</h1>", {
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const result = await fetchProvincialVacancies(fetcher);
    expect(result.records).toEqual([]);
    expect(result.failedSources).toEqual([
      {
        sourceId: "bc-public-service-vacancies",
        code: "POSTING_IDENTITY_CHANGED",
      },
    ]);
  });
});
