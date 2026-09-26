/** Official records are either an entry point or a location, never a claimed open award or vacancy. */
export type OfficialRecordKind =
  | "jobs_finder"
  | "benefits_finder"
  | "funding_finder"
  | "service_location";

export interface OfficialIngestRecord {
  id: string;
  sourceId: string;
  externalId: string;
  kind: OfficialRecordKind;
  title: string;
  summary: string;
  sourceUrl: string;
  evidenceUrl: string;
  publisher: string;
  jurisdictionLevel: "federal" | "provincial";
  jurisdictionCode: "CA" | "CA-BC";
  jurisdictionName: "Canada" | "British Columbia";
  licenceName: string | null;
  licenceUrl: string | null;
  termsUrl: string;
  language: "en";
  latitude: number | null;
  longitude: number | null;
  fetchedAt: string;
  expiresAt: string;
  payloadHash: string;
}

export interface OfficialIngestResult {
  records: OfficialIngestRecord[];
  failedSources: { sourceId: string; code: string }[];
}

const CANADA_TERMS = "https://www.canada.ca/en/transparency/terms.html";
const BC_LICENCE =
  "https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc";
const BC_CATALOGUE =
  "https://catalogue.data.gov.bc.ca/dataset/service-bc-office-locations";
const BC_LAYER =
  "https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_imagery_and_base_maps/MapServer/51";

const FEDERAL_FINDERS = [
  {
    sourceId: "gc-jobs",
    kind: "jobs_finder",
    title: "Government of Canada jobs",
    summary:
      "Browse federal public service opportunities and apply through GC Jobs.",
    sourceUrl:
      "https://www.canada.ca/en/services/jobs/opportunities/government.html",
    expectedTitle: "Government of Canada jobs",
  },
  {
    sourceId: "benefits-finder",
    kind: "benefits_finder",
    title: "Benefits Finder",
    summary:
      "Find federal programs and benefits using the Government of Canada's own filters.",
    sourceUrl: "https://www.canada.ca/en/services/benefits/finder.html",
    expectedTitle: "Benefits Finder",
  },
  {
    sourceId: "federal-grants-funding",
    kind: "funding_finder",
    title: "Grants and funding from the Government of Canada",
    summary:
      "Choose a funding category and continue to the official program site.",
    sourceUrl: "https://www.canada.ca/en/government/grants-funding.html",
    expectedTitle: "Grants and funding",
  },
] as const;

/** Fetches only known official hosts. No untrusted URL is accepted as an adapter input. */
export async function fetchOfficialRecords(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const records: OfficialIngestRecord[] = [];
  const failedSources: OfficialIngestResult["failedSources"] = [];
  const fetchedAt = now.toISOString();
  for (const finder of FEDERAL_FINDERS) {
    try {
      const html = await fetchText(
        fetcher,
        finder.sourceUrl,
        "text/html",
        1_000_000,
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
        expiresAt: expiry(now, 14),
        payloadHash: await sha256(html),
      });
    } catch (error) {
      failedSources.push({ sourceId: finder.sourceId, code: errorCode(error) });
    }
  }

  try {
    const query = new URL(`${BC_LAYER}/query`);
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
    const parsed: unknown = JSON.parse(payload);
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
          : BC_CATALOGUE;
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
        evidenceUrl: BC_LAYER,
        publisher: "Government of British Columbia",
        jurisdictionLevel: "provincial",
        jurisdictionCode: "CA-BC",
        jurisdictionName: "British Columbia",
        licenceName: "Open Government Licence - British Columbia",
        licenceUrl: BC_LICENCE,
        termsUrl: BC_LICENCE,
        language: "en",
        latitude: latitude !== null && longitude !== null ? latitude : null,
        longitude: latitude !== null && longitude !== null ? longitude : null,
        fetchedAt,
        expiresAt: expiry(now, 7),
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
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
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
  if (!response.ok) throw new SourceFetchError("SOURCE_HTTP_ERROR");
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

function expiry(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

function errorCode(error: unknown): string {
  return error instanceof SourceFetchError ? error.code : "SOURCE_FETCH_FAILED";
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
