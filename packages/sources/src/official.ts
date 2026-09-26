import { fetchBcOfficialRecords } from "./adapters/bc/index.js";
import { fetchFederalRecords } from "./adapters/federal/index.js";
import { fetchOntarioOfficialRecords } from "./adapters/ontario/index.js";

/** An official record is a verified handoff or a service location, never a claimed open award or vacancy. */
export type OfficialRecordKind =
  | "jobs_finder"
  | "benefits_finder"
  | "funding_finder"
  | "service_location";

export interface OfficialIngestRecord {
  id: string;
  sourceId: string;
  externalId: string;
  kind: OfficialRecordKind | null;
  title: string;
  summary: string;
  sourceUrl: string;
  evidenceUrl: string;
  publisher: string;
  jurisdictionLevel: "federal" | "provincial";
  jurisdictionCode: "CA" | "CA-BC" | "CA-ON";
  jurisdictionName: "Canada" | "British Columbia" | "Ontario";
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

/** Collectors have independent failure boundaries so one provincial outage does not hide others. */
export async function fetchOfficialRecords(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const results = await Promise.all([
    fetchFederalRecords(fetcher, now),
    fetchBcOfficialRecords(fetcher, now),
    fetchOntarioOfficialRecords(fetcher, now),
  ]);
  return {
    records: results.flatMap((result) => result.records),
    failedSources: results.flatMap((result) => result.failedSources),
  };
}
