import { describe, expect, it } from "vitest";
import { FEDERAL_SOURCES, fetchFederalRecords, hasHeading } from "./index.js";

describe("federal link-only sources", () => {
  it("recognizes a real page heading through markup and spaces", () => {
    expect(
      hasHeading(
        "<h1 class='page-title'>Grants and&nbsp;funding from the <span>Government of Canada</span></h1>",
        "Grants and funding from the Government of Canada",
      ),
    ).toBe(true);
    expect(
      hasHeading(
        "<title>Government of Canada jobs</title><h1>Access denied</h1>",
        "Government of Canada jobs",
      ),
    ).toBe(false);
  });

  it("keeps identity, attribution, and expiry for the five federal handoffs", async () => {
    const headings = new Map(
      FEDERAL_SOURCES.map((source) => [
        source.sourceUrl,
        source.expectedHeading,
      ]),
    );
    const fetcher = (async (input: RequestInfo | URL) => {
      const heading = headings.get(String(input));
      return new Response(`<main><h1>${heading}</h1></main>`, {
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;
    const now = new Date("2026-09-26T18:00:00.000Z");
    const result = await fetchFederalRecords(fetcher, now);
    expect(result.failedSources).toEqual([]);
    expect(result.records).toHaveLength(5);
    for (const record of result.records) {
      const definition = FEDERAL_SOURCES.find(
        (source) => source.sourceId === record.sourceId,
      )!;
      expect(record.sourceUrl).toBe(definition.sourceUrl);
      expect(record.evidenceUrl).toBe(definition.sourceUrl);
      expect(record.publisher).toBe("Government of Canada");
      expect(record.jurisdictionCode).toBe("CA");
      expect(record.termsUrl).toBe(
        "https://www.canada.ca/en/transparency/terms.html",
      );
      expect(record.fetchedAt).toBe(now.toISOString());
      expect(record.expiresAt).toBe(
        new Date(
          now.getTime() + definition.refreshDays * 86_400_000,
        ).toISOString(),
      );
      expect(record.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(
      result.records.find(
        (record) => record.sourceId === "federal-service-canada-offices",
      )?.kind,
    ).toBeNull();
    expect(
      result.records.find(
        (record) => record.sourceId === "federal-consultations-finder",
      )?.kind,
    ).toBeNull();
  });

  it("fails a changed page closed without claiming it was verified", async () => {
    const fetcher = (async () =>
      new Response("<h1>Access denied</h1>", {
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    const result = await fetchFederalRecords(fetcher);
    expect(result.records).toEqual([]);
    expect(result.failedSources).toHaveLength(5);
    expect(
      result.failedSources.every(
        (source) => source.code === "PAGE_IDENTITY_CHANGED",
      ),
    ).toBe(true);
  });
});
