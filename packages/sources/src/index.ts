export type SourceOrigin = "official_external" | "participating_org" | "sample";

export type SourceFreshness =
  | "unknown"
  | "current"
  | "stale"
  | "expired"
  | "error";

export type JurisdictionLevel =
  | "federal"
  | "provincial"
  | "municipal"
  | "regional"
  | "community";

export interface SourceRegistryEntry {
  id: string;
  origin: SourceOrigin;
  name: string;
  publisher: string;
  sourceUrl: string;
  jurisdiction: {
    level: JurisdictionLevel;
    code: string;
    name: string;
    municipality: { code: string; name: string } | null;
  };
  licence: { name: string | null; url: string | null };
  termsUrl: string | null;
  termsStatus: "unreviewed" | "permitted" | "restricted" | "prohibited";
  collectionMode:
    | "official_link"
    | "api"
    | "feed"
    | "dataset"
    | "manual"
    | "sample";
  fetchedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  freshness: SourceFreshness;
  lastError: string | null;
  sampleLabel: string | null;
}

export interface SourceRegistryRow {
  id: string;
  origin: SourceOrigin;
  name: string;
  publisher: string;
  source_url: string;
  jurisdiction_level: JurisdictionLevel;
  jurisdiction_code: string;
  jurisdiction_name: string;
  municipality_code: string | null;
  municipality_name: string | null;
  licence_name: string | null;
  licence_url: string | null;
  terms_url: string | null;
  terms_status: SourceRegistryEntry["termsStatus"];
  collection_mode: SourceRegistryEntry["collectionMode"];
  fetched_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  freshness_state: SourceFreshness;
  last_error: string | null;
  sample_label: string | null;
}

export function toSourceRegistryEntry(
  row: SourceRegistryRow,
): SourceRegistryEntry {
  const isSample = row.origin === "sample";
  const freshness =
    row.expires_at && Date.parse(row.expires_at) <= Date.now()
      ? "expired"
      : row.freshness_state;
  return {
    id: row.id,
    origin: row.origin,
    name: row.name,
    publisher: row.publisher,
    sourceUrl: row.source_url,
    jurisdiction: {
      level: row.jurisdiction_level,
      code: row.jurisdiction_code,
      name: row.jurisdiction_name,
      municipality:
        row.municipality_code && row.municipality_name
          ? { code: row.municipality_code, name: row.municipality_name }
          : null,
    },
    licence: { name: row.licence_name, url: row.licence_url },
    termsUrl: row.terms_url,
    termsStatus: row.terms_status,
    collectionMode: row.collection_mode,
    fetchedAt: row.fetched_at,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    freshness,
    lastError: row.last_error,
    sampleLabel: isSample ? row.sample_label : null,
  };
}

export function isPublicSourceOrigin(value: unknown): value is SourceOrigin {
  return (
    value === "official_external" ||
    value === "participating_org" ||
    value === "sample"
  );
}
