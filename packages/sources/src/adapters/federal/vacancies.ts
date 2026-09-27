import type {
  OfficialIngestRecord,
  OfficialIngestResult,
} from "../../official.js";

export const FEDERAL_STUDENT_JOBS_SOURCE_ID =
  "federal-student-specialized-inventories";
export const FEDERAL_STUDENT_JOBS_URL =
  "https://www.canada.ca/en/public-service-commission/jobs/services/recruitment/students/federal-student-work-program.html";
const CANADA_TERMS = "https://www.canada.ca/en/transparency/terms.html";
const MAX_HTML_BYTES = 500_000;
const MAX_POSTINGS = 30;
const DAY_MS = 86_400_000;

export interface FederalVacancyRecord extends OfficialIngestRecord {
  listing: {
    category: "job";
    postedDate: null;
    closingDate: string;
    locationText: null;
    applicationStatus: "open";
  };
  registry: {
    name: string;
    url: string;
    collectionMode: "official_link";
  };
}

export interface FederalVacancyResult
  extends Omit<OfficialIngestResult, "records"> {
  records: FederalVacancyRecord[];
  refreshedSourceIds: string[];
}

interface ParsedVacancy {
  posterId: string;
  title: string;
  organization: string;
  closingDate: string;
  sourceUrl: string;
  evidenceFragment: string;
}

/** Parse only the PSC's published, specialized student postings; a changed page fails closed. */
export function parseFederalStudentVacancies(html: string): ParsedVacancy[] {
  if (
    !/<h1\b[^>]*>\s*Federal Student Work Experience Program\s*<\/h1\s*>/i.test(
      html,
    )
  )
    throw new VacancySourceError("PAGE_IDENTITY_CHANGED");
  const sectionAt = html.search(
    /<h2\b[^>]*>\s*Specialized inventories\s*<\/h2\s*>/i,
  );
  if (sectionAt < 0) throw new VacancySourceError("LISTING_SECTION_CHANGED");
  const section = html.slice(sectionAt);
  const details = [
    ...section.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details\s*>/gi),
  ];
  if (details.length === 0 || details.length > MAX_POSTINGS)
    throw new VacancySourceError("LISTING_COUNT_CHANGED");

  const seen = new Set<string>();
  const vacancies: ParsedVacancy[] = [];
  for (const detail of details) {
    const fragment = detail[0];
    const body = detail[1];
    if (!fragment || !body)
      throw new VacancySourceError("LISTING_SCHEMA_CHANGED");
    const title = textOf(
      body.match(/<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/i)?.[1],
    );
    const organization = field(body, "Organization");
    const deadline = field(body, "Deadline to apply");
    const closingDate = parseEnglishDate(deadline);
    const rawLinks = [
      ...body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi),
    ];
    const posterLinks = rawLinks
      .map((match) => match[1]?.replace(/&amp;/gi, "&") ?? "")
      .filter((value) => value.includes("poster="));
    if (!title || !organization || !closingDate || posterLinks.length !== 1)
      throw new VacancySourceError("LISTING_SCHEMA_CHANGED");

    let link: URL;
    try {
      link = new URL(posterLinks[0]!);
    } catch {
      throw new VacancySourceError("LISTING_URL_CHANGED");
    }
    const posterId = link.searchParams.get("poster") ?? "";
    if (
      link.protocol !== "https:" ||
      link.hostname !== "emploisfp-psjobs.cfp-psc.gc.ca" ||
      link.pathname !== "/srs-sre/page01.html" ||
      !/^[0-9]{1,12}$/.test(posterId) ||
      link.searchParams.get("lang") !== "en" ||
      seen.has(posterId)
    )
      throw new VacancySourceError("LISTING_URL_CHANGED");
    seen.add(posterId);
    vacancies.push({
      posterId,
      title,
      organization,
      closingDate,
      sourceUrl: `https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.html?poster=${posterId}&lang=en`,
      evidenceFragment: fragment,
    });
  }
  return vacancies;
}

export async function fetchFederalVacancies(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<FederalVacancyResult> {
  try {
    const response = await fetcher(FEDERAL_STUDENT_JOBS_URL, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok)
      throw new VacancySourceError(`SOURCE_HTTP_${response.status}`);
    if (response.url && new URL(response.url).hostname !== "www.canada.ca")
      throw new VacancySourceError("SOURCE_REDIRECTED_OFFICIAL_HOST");
    const type = response.headers.get("content-type");
    if (type && !type.toLowerCase().includes("text/html"))
      throw new VacancySourceError("SOURCE_CONTENT_TYPE_CHANGED");
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_HTML_BYTES)
      throw new VacancySourceError("SOURCE_TOO_LARGE");
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES)
      throw new VacancySourceError("SOURCE_TOO_LARGE");
    const parsed = parseFederalStudentVacancies(html);
    const fetchedAt = now.toISOString();
    const today = fetchedAt.slice(0, 10);
    const records: FederalVacancyRecord[] = [];
    for (const vacancy of parsed) {
      if (vacancy.closingDate < today) continue;
      records.push({
        id: `official-federal-student-job-${vacancy.posterId}`,
        sourceId: FEDERAL_STUDENT_JOBS_SOURCE_ID,
        externalId: vacancy.posterId,
        kind: null,
        title: vacancy.title,
        summary: `${vacancy.organization}. Check the official posting for requirements and location.`,
        sourceUrl: vacancy.sourceUrl,
        evidenceUrl: FEDERAL_STUDENT_JOBS_URL,
        publisher: "Public Service Commission of Canada",
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
        expiresAt: new Date(now.getTime() + DAY_MS).toISOString(),
        payloadHash: await sha256(vacancy.evidenceFragment),
        listing: {
          category: "job",
          postedDate: null,
          closingDate: vacancy.closingDate,
          locationText: null,
          applicationStatus: "open",
        },
        registry: {
          name: "Federal student specialized inventories",
          url: FEDERAL_STUDENT_JOBS_URL,
          collectionMode: "official_link",
        },
      });
    }
    return {
      records,
      failedSources: [],
      refreshedSourceIds: [FEDERAL_STUDENT_JOBS_SOURCE_ID],
    };
  } catch (error) {
    return {
      records: [],
      failedSources: [
        { sourceId: FEDERAL_STUDENT_JOBS_SOURCE_ID, code: errorCode(error) },
      ],
      refreshedSourceIds: [],
    };
  }
}

function field(body: string, label: string): string {
  for (const match of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)) {
    const value = textOf(match[1]);
    const prefix = `${label}:`;
    if (value.toLowerCase().startsWith(prefix.toLowerCase()))
      return value.slice(prefix.length).trim();
  }
  return "";
}

function textOf(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+:/g, ":")
    .trim();
}

function parseEnglishDate(value: string): string | null {
  const match = value.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})$/i,
  );
  if (!match) return null;
  const month =
    [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(match[1]!.toLowerCase()) + 1;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.toISOString().slice(0, 10);
}

class VacancySourceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function errorCode(error: unknown): string {
  if (error instanceof VacancySourceError) return error.code;
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
