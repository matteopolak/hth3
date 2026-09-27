import { fetchBcOfficialRecords } from "./adapters/bc/index.js";
import { fetchCityVacancies } from "./adapters/city-jobs/index.js";
import { fetchFederalRecords } from "./adapters/federal/index.js";
import { fetchFederalVacancies } from "./adapters/federal/vacancies.js";
import { fetchOntarioOfficialRecords } from "./adapters/ontario/index.js";
import { fetchProvincialVacancies } from "./adapters/vacancies/index.js";

/** Directory links and actual sourced listings have distinct shapes. */
export type OfficialRecordKind =
  | "jobs_finder"
  | "benefits_finder"
  | "funding_finder"
  | "service_location";

/** Opening status is copied from an official source, never inferred from a directory. */
export interface OfficialListingMetadata {
  category: "job" | "support" | "funding";
  postedDate: string | null;
  closingDate: string | null;
  locationText: string | null;
  applicationStatus: "open" | "closed" | "unknown";
}

export interface OfficialSourceRegistration {
  name: string;
  url: string;
  collectionMode: "api" | "feed" | "dataset" | "official_link" | "manual";
}

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
  jurisdictionLevel: "federal" | "provincial" | "municipal";
  jurisdictionCode: string;
  jurisdictionName: string;
  municipalityCode?: string | null;
  municipalityName?: string | null;
  /** Required when an adapter introduces a source ID absent from the registry. */
  registry?: OfficialSourceRegistration;
  /** Present only for an individual, publisher-backed posting or program. */
  listing?: OfficialListingMetadata;
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
  /** A fully checked source may return zero current listings; omit on failure. */
  refreshedSourceIds?: string[];
}

/** Collectors have independent failure boundaries so one provincial outage does not hide others. */
export async function fetchOfficialRecords(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<OfficialIngestResult> {
  const results = await Promise.all([
    fetchFederalRecords(fetcher, now),
    fetchFederalVacancies(fetcher, now),
    fetchBcOfficialRecords(fetcher, now),
    fetchOntarioOfficialRecords(fetcher, now),
    fetchProvincialVacancies(fetcher, now),
    fetchCityVacancies(fetcher, now),
  ]);
  return {
    records: results.flatMap((result) => result.records),
    failedSources: results.flatMap((result) => result.failedSources),
    refreshedSourceIds: results.flatMap(
      (result) => result.refreshedSourceIds ?? [],
    ),
  };
}
