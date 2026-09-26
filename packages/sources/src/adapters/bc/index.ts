import type {
  OfficialIngestRecord,
  OfficialIngestResult,
  OfficialRecordKind,
} from "../../official.js";

const TERMS = "https://www2.gov.bc.ca/gov/content/home/copyright";
const LICENCE =
  "https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc";
const CATALOGUE =
  "https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations";
const LAYER =
  "https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_imagery_and_base_maps/MapServer/51";

export const BC_SOURCES = [
  {
    sourceId: "bc-public-service-jobs",
    kind: "jobs_finder",
    title: "Current B.C. Government job postings",
    summary:
      "Search BC Public Service postings and apply through the official Career Centre.",
    sourceUrl:
      "https://www2.gov.bc.ca/gov/content/careers-myhr/job-seekers/current-job-postings",
    expectedTitle: "Current B.C. Government job postings",
    maxBytes: 1_000_000,
  },
  {
    sourceId: "bc-benefits-connector",
    kind: "benefits_finder",
    title: "B.C. Benefits Connector",
    summary:
      "Explore provincial support programs and follow each official program's application instructions.",
    sourceUrl: "https://www2.gov.bc.ca/bcbenefitsconnector",
    expectedTitle: "B.C. Benefits Connector",
    maxBytes: 3_000_000,
  },
  {
    sourceId: "bc-funding-finder",
    kind: "funding_finder",
    title: "B.C. funding opportunities",
    summary:
      "Find provincial grants, bursaries, and loans through the official funding search.",
    sourceUrl: "https://www2.gov.bc.ca/gov/content/funding",
    expectedTitle: "Funding Opportunities",
    maxBytes: 1_000_000,
  },
] as const satisfies ReadonlyArray<{
  sourceId: string;
  kind: OfficialRecordKind;
  title: string;
  summary: string;
  sourceUrl: string;
  expectedTitle: string;
  maxBytes: number;
}>;

export async function fetchBcOfficialRecords(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const records: OfficialIngestRecord[] = [];
  const failedSources: OfficialIngestResult["failedSources"] = [];
  const fetchedAt = now.toISOString();

  for (const finder of BC_SOURCES) {
    try {
      const html = await fetchText(
        fetcher,
        finder.sourceUrl,
        "text/html",
        finder.maxBytes,
      );
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
        publisher: "Government of British Columbia",
        jurisdictionLevel: "provincial",
        jurisdictionCode: "CA-BC",
        jurisdictionName: "British Columbia",
        licenceName: null,
        licenceUrl: null,
        termsUrl: TERMS,
        language: "en",
        latitude: null,
        longitude: null,
        fetchedAt,
        expiresAt: expiry(now),
        payloadHash: await sha256(html),
      });
    } catch (error) {
      failedSources.push({ sourceId: finder.sourceId, code: errorCode(error) });
    }
  }

  try {
    const query = new URL(`${LAYER}/query`);
    query.searchParams.set("where", "1=1");
    query.searchParams.set(
      "outFields",
      "SEQUENCE_ID,OFFICE_CODE,OFFICE_NAME,PHYSICAL_ADDRESS,LOCALITY,WEBSITE_URL,LATITUDE,LONGITUDE",
    );
    query.searchParams.set("returnGeometry", "false");
    query.searchParams.set("f", "json");
    const payload = await fetchText(
      fetcher,
      query.toString(),
      "application/json",
      3_000_000,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new SourceFetchError("DIRECTORY_INVALID_JSON");
    }
    if (
      !isObject(parsed) ||
      !Array.isArray(parsed.features) ||
      parsed.exceededTransferLimit === true ||
      parsed.features.length >= 1_000 ||
      isObject(parsed.error)
    )
      throw new SourceFetchError("DIRECTORY_SCHEMA_CHANGED");

    const seen = new Set<string>();
    for (const feature of parsed.features) {
      if (!isObject(feature) || !isObject(feature.attributes)) continue;
      const attrs = feature.attributes;
      const title = trimmed(attrs.OFFICE_NAME);
      const key = trimmed(attrs.OFFICE_CODE) || String(attrs.SEQUENCE_ID ?? "");
      if (!title || !/^[A-Za-z0-9_-]{1,80}$/.test(key) || seen.has(key))
        continue;
      seen.add(key);
      const location = [
        trimmed(attrs.PHYSICAL_ADDRESS),
        trimmed(attrs.LOCALITY),
      ]
        .filter(Boolean)
        .join(", ");
      const website = trimmed(attrs.WEBSITE_URL);
      const sourceUrl =
        website && /^https:\/\/(?:[^/]+\.)?gov\.bc\.ca\//i.test(website)
          ? website
          : CATALOGUE;
      const latitude = coordinate(attrs.LATITUDE, -90, 90);
      const longitude = coordinate(attrs.LONGITUDE, -180, 180);
      records.push({
        id: `official-service-bc-${key}`,
        sourceId: "service-bc-office-locations",
        externalId: key,
        kind: "service_location",
        title,
        summary: location
          ? `Service BC office at ${location}. Confirm hours and services on the official site before visiting.`
          : "Service BC office. Confirm hours and services on the official site before visiting.",
        sourceUrl,
        evidenceUrl: LAYER,
        publisher: "Government of British Columbia",
        jurisdictionLevel: "provincial",
        jurisdictionCode: "CA-BC",
        jurisdictionName: "British Columbia",
        licenceName: "Open Government Licence - British Columbia",
        licenceUrl: LICENCE,
        termsUrl: LICENCE,
        language: "en",
        latitude: latitude !== null && longitude !== null ? latitude : null,
        longitude: latitude !== null && longitude !== null ? longitude : null,
        fetchedAt,
        expiresAt: expiry(now),
        payloadHash: await sha256(JSON.stringify(attrs)),
      });
    }
    if (seen.size === 0) throw new SourceFetchError("EMPTY_DIRECTORY");
  } catch (error) {
    failedSources.push({
      sourceId: "service-bc-office-locations",
      code: errorCode(error),
    });
  }

  return { records, failedSources };
}

class SourceFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function fetchText(
  fetcher: typeof fetch,
  url: string,
  type: string,
  maxBytes: number,
): Promise<string> {
  const response = await fetcher(url, {
    headers: { Accept: type },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok)
    throw new SourceFetchError(`SOURCE_HTTP_${response.status}`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes)
    throw new SourceFetchError("SOURCE_TOO_LARGE");
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes)
    throw new SourceFetchError("SOURCE_TOO_LARGE");
  return body;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function expiry(now: Date): string {
  return new Date(now.getTime() + 7 * 86_400_000).toISOString();
}

function errorCode(error: unknown): string {
  if (error instanceof SourceFetchError) return error.code;
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
