import type {
  OfficialIngestRecord,
  OfficialIngestResult,
  OfficialRecordKind,
} from "../../official.js";

const CANADA_TERMS = "https://www.canada.ca/en/transparency/terms.html";
const MAX_HTML_BYTES = 1_000_000;

export interface FederalSourceDefinition {
  sourceId: string;
  kind: OfficialRecordKind | null;
  area: "jobs" | "support" | "funding" | "nearby" | "participation";
  title: string;
  summary: string;
  sourceUrl: string;
  expectedHeading: string;
  refreshDays: number;
}

/** These are handoff pages. None represent an individual live vacancy, award, office, or consultation. */
export const FEDERAL_SOURCES: readonly FederalSourceDefinition[] = [
  {
    sourceId: "gc-jobs",
    kind: "jobs_finder",
    area: "jobs",
    title: "Government of Canada jobs",
    summary:
      "Search federal public service jobs on the Government of Canada site.",
    sourceUrl:
      "https://www.canada.ca/en/services/jobs/opportunities/government.html",
    expectedHeading: "Government of Canada jobs",
    refreshDays: 7,
  },
  {
    sourceId: "benefits-finder",
    kind: "benefits_finder",
    area: "support",
    title: "Benefits Finder",
    summary:
      "Use the federal Benefits Finder to look for programs and support.",
    sourceUrl: "https://www.canada.ca/en/services/benefits/finder.html",
    expectedHeading: "Benefits Finder",
    refreshDays: 30,
  },
  {
    sourceId: "federal-grants-funding",
    kind: "funding_finder",
    area: "funding",
    title: "Grants and funding from the Government of Canada",
    summary: "Choose a funding category on the official federal site.",
    sourceUrl: "https://www.canada.ca/en/government/grants-funding.html",
    expectedHeading: "Grants and funding from the Government of Canada",
    refreshDays: 30,
  },
  {
    sourceId: "federal-service-canada-offices",
    kind: null,
    area: "nearby",
    title: "Find a Service Canada office",
    summary:
      "Open the official ESDC contact page to find a Service Canada office and check its services and hours.",
    sourceUrl:
      "https://www.canada.ca/en/employment-social-development/corporate/contact.html",
    expectedHeading: "Contact Employment and Social Development Canada (ESDC)",
    refreshDays: 30,
  },
  {
    sourceId: "federal-consultations-finder",
    kind: null,
    area: "participation",
    title: "Consulting with Canadians",
    summary:
      "Search federal consultations and continue to the official participation page.",
    sourceUrl:
      "https://www.canada.ca/en/government/system/consultations/consultingcanadians.html",
    expectedHeading: "Consulting with Canadians",
    refreshDays: 7,
  },
];

/** Fetch each allowlisted page and publish only our own finder descriptions after identity verification. */
export async function fetchFederalRecords(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const records: OfficialIngestRecord[] = [];
  const failedSources: OfficialIngestResult["failedSources"] = [];
  const fetchedAt = now.toISOString();

  for (const source of FEDERAL_SOURCES) {
    try {
      const response = await fetcher(source.sourceUrl, {
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok)
        throw new FederalSourceError(`SOURCE_HTTP_${response.status}`);
      if (response.url && new URL(response.url).hostname !== "www.canada.ca")
        throw new FederalSourceError("SOURCE_REDIRECTED_OFFICIAL_HOST");
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().includes("text/html"))
        throw new FederalSourceError("SOURCE_CONTENT_TYPE_CHANGED");
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > MAX_HTML_BYTES)
        throw new FederalSourceError("SOURCE_TOO_LARGE");
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES)
        throw new FederalSourceError("SOURCE_TOO_LARGE");
      if (!hasHeading(html, source.expectedHeading))
        throw new FederalSourceError("PAGE_IDENTITY_CHANGED");

      records.push({
        id: `official-${source.sourceId}`,
        sourceId: source.sourceId,
        externalId: source.sourceUrl,
        kind: source.kind,
        title: source.title,
        summary: source.summary,
        sourceUrl: source.sourceUrl,
        evidenceUrl: source.sourceUrl,
        publisher: "Government of Canada",
        jurisdictionLevel: "federal",
        jurisdictionCode: "CA",
        jurisdictionName: "Canada",
        licenceName: null,
        licenceUrl: null,
        termsUrl: CANADA_TERMS,
        language: "en",
        latitude: null,
        longitude: null,
        fetchedAt,
        expiresAt: new Date(
          now.getTime() + source.refreshDays * 86_400_000,
        ).toISOString(),
        payloadHash: await sha256(html),
      });
    } catch (error) {
      failedSources.push({ sourceId: source.sourceId, code: errorCode(error) });
    }
  }

  return { records, failedSources };
}

export function hasHeading(html: string, expectedHeading: string): boolean {
  const headings = html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi);
  const expected = normalizeHeading(expectedHeading);
  for (const match of headings) {
    if (normalizeHeading(match[1] ?? "") === expected) return true;
  }
  return false;
}

function normalizeHeading(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-CA");
}

class FederalSourceError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function errorCode(error: unknown): string {
  if (error instanceof FederalSourceError) return error.code;
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  )
    return "SOURCE_TIMEOUT";
  if (error instanceof TypeError) return "SOURCE_NETWORK_ERROR";
  return "SOURCE_FETCH_FAILED";
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
