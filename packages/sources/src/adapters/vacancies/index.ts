import type {
  OfficialIngestRecord,
  OfficialIngestResult,
} from "../../official.js";

const SOURCE_ID = "bc-public-service-vacancies";
const BOARD_URL =
  "https://www2.gov.bc.ca/gov/content/careers-myhr/job-seekers/current-job-postings";
const TERMS_URL = "https://www2.gov.bc.ca/gov/content/home/copyright";
const DETAIL_ROOT =
  "https://bcpublicservice.hua.hrsmart.com/hr/ats/Posting/view/";
const MAX_HTML_BYTES = 300_000;

/** Curated direct pages only. The publisher's robots.txt disallows automated JobSearch. */
const POSTING_IDS = ["124147", "123788", "124288"] as const;

/**
 * Verify a small set of public BC Public Service posting pages. We retain only
 * factual identifiers, title, location, and closing date—not the job body.
 */
export async function fetchProvincialVacancies(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const records: OfficialIngestRecord[] = [];
  const fetchedAt = now.toISOString();
  const today = bcDate(now);

  try {
    for (const postingId of POSTING_IDS) {
      const sourceUrl = `${DETAIL_ROOT}${postingId}`;
      const response = await fetcher(sourceUrl, {
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok)
        throw new VacancyFetchError(`SOURCE_HTTP_${response.status}`);
      if (response.url && response.url !== sourceUrl)
        throw new VacancyFetchError("POSTING_REDIRECTED");
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.toLowerCase().includes("text/html"))
        throw new VacancyFetchError("SOURCE_CONTENT_TYPE_CHANGED");
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > MAX_HTML_BYTES)
        throw new VacancyFetchError("SOURCE_TOO_LARGE");
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES)
        throw new VacancyFetchError("SOURCE_TOO_LARGE");
      if (!html.includes("BC Public Service") || !html.includes("Job Details"))
        throw new VacancyFetchError("POSTING_IDENTITY_CHANGED");

      const title = field(html, "job_details_ats_requisition_title");
      const location = field(html, "job_details_hua_location_id");
      const close = field(html, "job_details_f_close_date_0");
      if (!title || title.length > 180 || !location || location.length > 300)
        throw new VacancyFetchError("POSTING_FIELDS_CHANGED");
      const closingDate = close ? dateFromUs(close) : null;
      if (close && !closingDate)
        throw new VacancyFetchError("POSTING_DATE_CHANGED");
      if (closingDate && closingDate < today) continue;

      records.push({
        id: `official-bc-vacancy-${postingId}`,
        sourceId: SOURCE_ID,
        externalId: postingId,
        kind: null,
        title,
        summary:
          "Check the official BC Public Service posting for requirements and application instructions.",
        sourceUrl,
        evidenceUrl: sourceUrl,
        publisher: "Government of British Columbia",
        jurisdictionLevel: "provincial",
        jurisdictionCode: "CA-BC",
        jurisdictionName: "British Columbia",
        registry: {
          name: "BC Public Service vacancies",
          url: BOARD_URL,
          collectionMode: "manual",
        },
        listing: {
          category: "job",
          postedDate: null,
          closingDate,
          locationText: location,
          applicationStatus:
            closingDate && closingDate > today ? "open" : "unknown",
        },
        licenceName: null,
        licenceUrl: null,
        termsUrl: TERMS_URL,
        language: "en",
        latitude: null,
        longitude: null,
        fetchedAt,
        expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
        payloadHash: await sha256(html),
      });
    }
    return { records, failedSources: [], refreshedSourceIds: [SOURCE_ID] };
  } catch (error) {
    return {
      records: [],
      failedSources: [{ sourceId: SOURCE_ID, code: errorCode(error) }],
    };
  }
}

class VacancyFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function field(html: string, id: string): string {
  const match = html.match(
    new RegExp(
      `<div\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/div>`,
      "i",
    ),
  );
  return decodeHtml((match?.[1] ?? "").replace(/<br\s*\/?\s*>/gi, "; "))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(?:;\s*)+$/, "")
    .trim();
}

function decodeHtml(input: string): string {
  const names: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
  };
  return input.replace(
    /&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#")) {
        const hex = entity[1]?.toLowerCase() === "x";
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return names[entity.toLowerCase()] ?? match;
    },
  );
}

function dateFromUs(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, month, day, year] = match;
  const iso = `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

function bcDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function errorCode(error: unknown): string {
  if (error instanceof VacancyFetchError) return error.code;
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
