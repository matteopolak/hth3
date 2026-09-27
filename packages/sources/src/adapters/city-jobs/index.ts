import type {
  OfficialIngestRecord,
  OfficialIngestResult,
} from "../../official.js";

type City = {
  sourceId: string;
  name: string;
  code: string;
  origin: string;
  searchUrl: string;
  jobPath: string;
  termsUrl: string;
};

/** Public SuccessFactors boards. Calgary is excluded: its site terms prohibit automated extraction. */
export const CITY_JOB_SOURCES: readonly City[] = [
  {
    sourceId: "city-ottawa-open-jobs",
    name: "Ottawa",
    code: "CA-ON-OTTAWA",
    origin: "https://jobs-emplois.ottawa.ca",
    searchUrl:
      "https://jobs-emplois.ottawa.ca/city-jobs/search/?q=&sortColumn=referencedate&sortDirection=desc",
    jobPath: "/city-jobs/job/",
    termsUrl: "https://ottawa.ca/en/terms-use/disclaimer",
  },
  {
    sourceId: "city-toronto-open-jobs",
    name: "Toronto",
    code: "CA-ON-TORONTO",
    origin: "https://jobs.toronto.ca",
    searchUrl:
      "https://jobs.toronto.ca/jobsatcity/search/?q=&sortColumn=referencedate&sortDirection=desc",
    jobPath: "/jobsatcity/job/",
    termsUrl: "https://www.toronto.ca/home/copyright-information/",
  },
];

const MAX_POSTINGS_PER_CITY = 12;
const MAX_HTML_BYTES = 500_000;

/**
 * Collect only factual, link-only vacancy metadata from current public search results.
 * An unrecognised template, date, host, or publisher ID never becomes an "open" job.
 */
export async function fetchCityVacancies(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const batches = await Promise.all(
    CITY_JOB_SOURCES.map((city) => fetchCity(city, fetcher, now)),
  );
  return {
    records: batches.flatMap((batch) => batch.records),
    failedSources: batches.flatMap((batch) => batch.failedSources),
    refreshedSourceIds: batches.flatMap(
      (batch) => batch.refreshedSourceIds ?? [],
    ),
  };
}

async function fetchCity(
  city: City,
  fetcher: typeof fetch,
  now: Date,
): Promise<OfficialIngestResult> {
  try {
    const searchHtml = await fetchHtml(city.searchUrl, city, fetcher);
    const links = parseSearchLinks(searchHtml, city).slice(
      0,
      MAX_POSTINGS_PER_CITY,
    );
    if (links.length === 0) {
      if (hasExplicitZeroResults(searchHtml, city))
        return {
          records: [],
          failedSources: [],
          refreshedSourceIds: [city.sourceId],
        };
      throw new SourceError("SOURCE_SEARCH_TEMPLATE_CHANGED");
    }

    const records: OfficialIngestRecord[] = [];
    // Keep requests sequential and bounded to avoid loading a public careers site.
    for (const link of links) {
      const detailHtml = await fetchHtml(link, city, fetcher);
      const detail = parsePosting(detailHtml, city, now);
      if (!detail) continue;
      const fetchedAt = now.toISOString();
      records.push({
        id: `official-${city.sourceId}-${detail.publisherId}`,
        sourceId: city.sourceId,
        externalId: detail.publisherId,
        kind: null,
        title: detail.title,
        summary: `View this City of ${city.name} vacancy and apply on the official careers site.`,
        sourceUrl: link,
        evidenceUrl: link,
        publisher: `City of ${city.name}`,
        jurisdictionLevel: "municipal",
        jurisdictionCode: city.code,
        jurisdictionName: city.name,
        municipalityCode: city.code,
        municipalityName: city.name,
        licenceName: null,
        licenceUrl: null,
        termsUrl: city.termsUrl,
        language: "en",
        latitude: null,
        longitude: null,
        fetchedAt,
        expiresAt: expiryFor(detail.closingDate, now).toISOString(),
        payloadHash: await sha256(
          [
            detail.publisherId,
            detail.title,
            detail.postedDate,
            detail.closingDate,
            detail.locationText,
            link,
          ].join("|"),
        ),
        listing: {
          category: "job",
          postedDate: detail.postedDate,
          closingDate: detail.closingDate,
          locationText: detail.locationText,
          applicationStatus: "open",
        },
        registry: {
          name: `City of ${city.name} current job postings`,
          url: city.searchUrl,
          collectionMode: "official_link",
        },
      });
    }
    if (records.length === 0)
      throw new SourceError("SOURCE_NO_VERIFIED_OPEN_POSTINGS");
    return { records, failedSources: [], refreshedSourceIds: [city.sourceId] };
  } catch (error) {
    return {
      records: [],
      failedSources: [{ sourceId: city.sourceId, code: errorCode(error) }],
    };
  }
}

async function fetchHtml(
  url: string,
  city: City,
  fetcher: typeof fetch,
): Promise<string> {
  const requested = new URL(url);
  if (requested.origin !== city.origin || requested.protocol !== "https:")
    throw new SourceError("SOURCE_REDIRECTED_OFFICIAL_HOST");
  const response = await fetcher(url, {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new SourceError(`SOURCE_HTTP_${response.status}`);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.origin !== city.origin || finalUrl.protocol !== "https:")
    throw new SourceError("SOURCE_REDIRECTED_OFFICIAL_HOST");
  if (
    !(response.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("text/html")
  )
    throw new SourceError("SOURCE_CONTENT_TYPE_CHANGED");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_HTML_BYTES)
    throw new SourceError("SOURCE_TOO_LARGE");
  const html = await response.text();
  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES)
    throw new SourceError("SOURCE_TOO_LARGE");
  return html;
}

export function parseSearchLinks(html: string, city: City): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(
    /<a\b[^>]*\bclass="[^"]*\bjobTitle-link\b[^"]*"[^>]*>/gi,
  )) {
    const href = match[0].match(/\bhref="([^"]+)"/i)?.[1];
    if (!href) continue;
    try {
      const url = new URL(decodeHtml(href), city.origin);
      if (url.origin !== city.origin || !url.pathname.startsWith(city.jobPath))
        continue;
      if (!/\/\d+\/$/.test(url.pathname)) continue;
      links.add(url.toString());
    } catch {
      // A malformed link is not a verified vacancy.
    }
  }
  return [...links];
}

function hasExplicitZeroResults(html: string, city: City): boolean {
  return city.name === "Toronto"
    ? /jobRecordsFound:\s*parseInt\("0"\)/.test(html)
    : /id="searchresults"[\s\S]{0,300}aria-label="[^"]*Results 0 (?:to|-) 0 of 0"/i.test(
        html,
      );
}

export function parsePosting(
  html: string,
  city: City,
  now: Date,
): {
  publisherId: string;
  title: string;
  postedDate: string | null;
  closingDate: string;
  locationText: string;
} | null {
  if (!html.includes('itemtype="http://schema.org/JobPosting"')) return null;
  const title = plainText(
    html.match(
      /<span\b[^>]*\bitemprop="title"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1] ?? "",
  );
  if (!title || title.length > 200) return null;
  const text = plainText(html.replace(/<br\s*\/?\s*>|<\/li>|<\/p>/gi, "\n"));
  const idLabel = city.name === "Ottawa" ? "Requisition ID" : "Job ID";
  const publisherId = text.match(
    new RegExp(`${idLabel}:\\s*(\\d{3,10})\\b`, "i"),
  )?.[1];
  if (!publisherId) return null;
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  let postedDate: string | null = null;
  let closingDate: string | null = null;
  let locationText: string | null = null;
  if (city.name === "Ottawa") {
    closingDate = parseDmy(
      text.match(/Application Close:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1],
    );
    locationText =
      text.match(/(?:^|\n)\s*Location:\s*([^\n]{3,160})/i)?.[1]?.trim() ?? null;
    const posted = html.match(
      /itemprop="datePosted"\s+content="([^"]+)"/i,
    )?.[1];
    postedDate = posted ? parseSchemaDate(posted) : null;
  } else {
    const period = text.match(
      /Posting Period:\s*(\d{1,2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i,
    );
    postedDate = parseMonDate(period?.[1]);
    closingDate = parseMonDate(period?.[2]);
    locationText =
      text.match(/(?:^|\n)\s*Work Location:\s*([^\n]{3,160})/i)?.[1]?.trim() ??
      null;
  }
  if (!closingDate || !locationText || closingDate < localDay) return null;
  return { publisherId, title, postedDate, closingDate, locationText };
}

function plainText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function decodeHtml(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (_, entity: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      if (entity[0] === "#") {
        const code =
          entity[1]?.toLowerCase() === "x"
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      }
      return named[entity.toLowerCase()] ?? "";
    },
  );
}

function parseDmy(value: string | undefined): string | null {
  if (!value) return null;
  const [day, month, year] = value.split("/").map(Number);
  return isoDate(year!, month!, day!);
}

function parseMonDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month =
    [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].indexOf(match[2]!.toLowerCase()) + 1;
  return isoDate(Number(match[3]), month, Number(match[1]));
}

function parseSchemaDate(value: string): string | null {
  const match = value.match(
    /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) \d{2}:\d{2}:\d{2} UTC (\d{4})$/,
  );
  if (!match) return null;
  return parseMonDate(`${match[2]}-${match[1]}-${match[3]}`);
}

function isoDate(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.toISOString().slice(0, 10);
}

function expiryFor(closingDate: string, now: Date): Date {
  // 04:00 UTC is no later than midnight in Toronto; it avoids a false-open window at close.
  const [year, month, day] = closingDate.split("-").map(Number);
  const closure = Date.UTC(year!, month! - 1, day! + 1, 4);
  return new Date(Math.min(now.getTime() + 12 * 60 * 60_000, closure));
}

class SourceError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function errorCode(error: unknown): string {
  if (error instanceof SourceError) return error.code;
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  )
    return "SOURCE_TIMEOUT";
  if (error instanceof TypeError) return "SOURCE_NETWORK_ERROR";
  return "SOURCE_FETCH_FAILED";
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
