import type {
  OfficialListingMetadata,
  OfficialRecordKind,
} from "./official.js";

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

export interface SourceRecord {
  id: string;
  sourceId: string;
  origin: SourceOrigin;
  externalId: string | null;
  title: string;
  summary: string;
  sourceUrl: string;
  publisher: string;
  jurisdiction: SourceRegistryEntry["jurisdiction"];
  licence: SourceRegistryEntry["licence"];
  termsUrl: string | null;
  termsStatus: SourceRegistryEntry["termsStatus"];
  language: "en" | "fr" | "und";
  fetchedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  payloadHash: string | null;
  evidenceUrl: string | null;
  freshness: SourceFreshness;
  lastErrorCode: string | null;
  sampleLabel: string | null;
  verified: boolean;
}

export interface SourceRecordWithDetails extends SourceRecord {
  kind: OfficialRecordKind | null;
  coordinates: { latitude: number; longitude: number } | null;
  listing: OfficialListingMetadata | null;
}

/** Never keep an "open" claim after review expires or on an unknown cutoff day. */
export function effectiveListingStatus(
  record: Pick<SourceRecord, "verified">,
  listing: Pick<OfficialListingMetadata, "closingDate" | "applicationStatus">,
  now = new Date(),
): OfficialListingMetadata["applicationStatus"] {
  if (listing.applicationStatus === "closed") return "closed";
  if (listing.closingDate) {
    const today = now.toISOString().slice(0, 10);
    if (listing.closingDate < today) return "closed";
    if (listing.closingDate === today) return "unknown";
  }
  if (!record.verified) return "unknown";
  return listing.applicationStatus;
}

export interface SourceRecordRow {
  id: string;
  source_id: string;
  origin: SourceOrigin;
  external_id: string | null;
  title: string;
  summary: string;
  source_url: string;
  publisher: string;
  jurisdiction_level: JurisdictionLevel;
  jurisdiction_code: string;
  jurisdiction_name: string;
  municipality_code: string | null;
  municipality_name: string | null;
  licence_name: string | null;
  licence_url: string | null;
  terms_url: string | null;
  terms_status: SourceRegistryEntry["termsStatus"];
  language: "en" | "fr" | "und";
  fetched_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  payload_hash: string | null;
  evidence_url: string | null;
  freshness_state: SourceFreshness;
  last_error_code: string | null;
  sample_label: string | null;
}

export function toSourceRegistryEntry(
  row: SourceRegistryRow,
  now = new Date(),
): SourceRegistryEntry {
  const isSample = row.origin === "sample";
  const freshness = effectiveFreshness(
    row.freshness_state,
    row.fetched_at,
    row.verified_at,
    row.expires_at,
    now,
  );
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

export function toSourceRecord(
  row: SourceRecordRow,
  now = new Date(),
): SourceRecord {
  const freshness = effectiveFreshness(
    row.freshness_state,
    row.fetched_at,
    row.verified_at,
    row.expires_at,
    now,
  );
  const isSample = row.origin === "sample";
  return {
    id: row.id,
    sourceId: row.source_id,
    origin: row.origin,
    externalId: row.external_id,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    publisher: row.publisher,
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
    language: row.language,
    fetchedAt: row.fetched_at,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    payloadHash: row.payload_hash,
    evidenceUrl: row.evidence_url,
    freshness,
    lastErrorCode: row.last_error_code,
    sampleLabel: isSample ? row.sample_label : null,
    verified:
      !isSample &&
      row.terms_status === "permitted" &&
      isAtOrBefore(row.verified_at, now) &&
      freshness === "current",
  };
}

function effectiveFreshness(
  stored: SourceFreshness,
  fetchedAt: string | null,
  verifiedAt: string | null,
  expiresAt: string | null,
  now: Date,
): SourceFreshness {
  if (stored === "error") return stored;
  const expiry = timestamp(expiresAt);
  if (expiresAt !== null && expiry === null) return "unknown";
  if (expiry !== null && expiry <= now.getTime()) return "expired";
  if (
    !isValidNotFutureOrNull(fetchedAt, now) ||
    !isValidNotFutureOrNull(verifiedAt, now)
  )
    return "unknown";
  return stored;
}

function isAtOrBefore(value: string | null, now: Date): boolean {
  if (value === null) return false;
  const parsed = timestamp(value);
  return parsed !== null && parsed <= now.getTime();
}

function isValidNotFutureOrNull(value: string | null, now: Date): boolean {
  return value === null || isAtOrBefore(value, now);
}

function timestamp(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPublicSourceOrigin(value: unknown): value is SourceOrigin {
  return (
    value === "official_external" ||
    value === "participating_org" ||
    value === "sample"
  );
}

export * from "./official.js";
