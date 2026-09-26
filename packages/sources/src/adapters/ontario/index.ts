import type { OfficialIngestRecord, OfficialIngestResult, OfficialRecordKind } from "../../official.js";

const TERMS = "https://www.ontario.ca/page/terms-use";

/** Ontario pages are discovery links, not copied vacancies, grants, eligibility, or office pins. */
export const ONTARIO_SOURCES = [
  {
    sourceId: "ontario-public-service-jobs",
    kind: "jobs_finder",
    title: "Careers: Ontario Public Service",
    summary: "Explore Ontario Public Service careers and follow the official site to search current postings.",
    sourceUrl: "https://www.ontario.ca/page/careers-ontario-public-service",
    expectedTitle: "Careers: Ontario Public Service",
  },
  {
    sourceId: "ontario-benefits-finder",
    kind: "benefits_finder",
    title: "Find benefits and programs",
    summary: "Use Ontario's official finder to explore support programs and check requirements with each program.",
    sourceUrl: "https://www.ontario.ca/page/find-benefits-and-programs",
    expectedTitle: "Find benefits and programs",
  },
  {
    sourceId: "ontario-funding-finder",
    kind: "funding_finder",
    title: "Available funding opportunities from the Ontario Government",
    summary: "Review Ontario's current funding list and apply through the official program process.",
    sourceUrl: "https://www.ontario.ca/page/available-funding-opportunities-ontario-government",
    expectedTitle: "Available funding opportunities from the Ontario Government",
  },
  {
    sourceId: "serviceontario-location-finder",
    kind: null,
    title: "ServiceOntario locations, hours and contact",
    summary: "Search official ServiceOntario locations and confirm hours and services before visiting.",
    sourceUrl: "https://www.ontario.ca/locations/serviceontario/",
    expectedTitle: "ServiceOntario locations, hours and contact",
  },
] as const satisfies ReadonlyArray<{
  sourceId: string;
  kind: OfficialRecordKind | null;
  title: string;
  summary: string;
  sourceUrl: string;
  expectedTitle: string;
}>;

export async function fetchOntarioOfficialRecords(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const records: OfficialIngestRecord[] = [];
  const failedSources: OfficialIngestResult["failedSources"] = [];
  const fetchedAt = now.toISOString();

  for (const finder of ONTARIO_SOURCES) {
    try {
      const response = await fetcher(finder.sourceUrl, {
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new SourceFetchError(`SOURCE_HTTP_${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("text/html"))
        throw new SourceFetchError("SOURCE_CONTENT_TYPE_CHANGED");
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > 1_000_000)
        throw new SourceFetchError("SOURCE_TOO_LARGE");
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > 1_000_000)
        throw new SourceFetchError("SOURCE_TOO_LARGE");
      if (!html.toLowerCase().includes(finder.expectedTitle.toLowerCase()))
        throw new SourceFetchError("PAGE_IDENTITY_CHANGED");

      records.push({
        id: `official-${finder.sourceId}`,
        sourceId: finder.sourceId,
        externalId: finder.sourceUrl,
        kind: finder.kind,
        title: finder.title,
        summary: finder.summary,
        sourceUrl: finder.sourceUrl,
        evidenceUrl: finder.sourceUrl,
        publisher: "Government of Ontario",
        jurisdictionLevel: "provincial",
        jurisdictionCode: "CA-ON",
        jurisdictionName: "Ontario",
        licenceName: null,
        licenceUrl: null,
        termsUrl: TERMS,
        language: "en",
        latitude: null,
        longitude: null,
        fetchedAt,
        expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
        payloadHash: await sha256(html),
      });
    } catch (error) {
      failedSources.push({ sourceId: finder.sourceId, code: errorCode(error) });
    }
  }

  return { records, failedSources };
}

class SourceFetchError extends Error {
  constructor(readonly code: string) { super(code); }
}

function errorCode(error: unknown): string {
  if (error instanceof SourceFetchError) return error.code;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return "SOURCE_TIMEOUT";
  if (error instanceof TypeError) return "SOURCE_NETWORK_ERROR";
  return "SOURCE_FETCH_FAILED";
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
