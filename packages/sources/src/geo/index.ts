/** Reviewed facts about a public place. Empty hours or accessibility mean unknown. */
export type ServiceCategory =
  | "government"
  | "library"
  | "community"
  | "transit"
  | "other";

export interface ServiceLocationMetadata {
  record_id: string;
  service_category: ServiceCategory;
  address: string | null;
  public_access_summary: string | null;
  services_summary: string | null;
  hours_summary: string | null;
  accessibility_summary: string | null;
  details_verified_at: string | null;
  details_source_url: string | null;
}

export interface ServiceFact {
  status: "verified" | "stale" | "unknown";
  summary: string;
  verifiedAt: string | null;
  sourceUrl: string;
}

export interface ServiceLocationView {
  category: ServiceCategory;
  address: string | null;
  publicAccess: ServiceFact;
  services: ServiceFact;
  hours: ServiceFact;
  accessibility: ServiceFact;
  pinEligible: boolean;
  pinKind: "official" | "sample" | null;
}

export interface ServiceLocationInput {
  id: string;
  sourceId: string;
  origin: "official_external" | "participating_org" | "sample";
  summary: string;
  sourceUrl: string;
  evidenceUrl: string | null;
  verified: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  coordinates: { latitude: number; longitude: number } | null;
}

const BC_SERVICE_URL =
  "https://www2.gov.bc.ca/gov/content/governments/organizational-structure/ministries-organizations/ministries/citizens-services/servicebc";
const BC_REVIEWED_AT = "2026-09-26T19:00:00.000Z";
const BC_REVIEW_EXPIRES_AT = "2026-10-03T19:00:00.000Z";

/**
 * Service BC's directory proves location and coordinates; its separate public
 * counter page proves only the generic Service BC service. It explicitly says
 * offerings and hours differ by office, so neither is inferred per location.
 */
export function serviceBcMetadata(
  record: ServiceLocationInput,
): ServiceLocationMetadata | null {
  if (record.sourceId !== "service-bc-office-locations") return null;
  const address = /^Service BC office at (.+?)\. Confirm hours/i.exec(
    record.summary,
  )?.[1];
  return {
    record_id: record.id,
    service_category: "government",
    address: address ?? null,
    public_access_summary: "Public Service BC counter",
    services_summary:
      "Service BC counter services; availability varies by office",
    hours_summary: null,
    accessibility_summary: null,
    details_verified_at: BC_REVIEWED_AT,
    details_source_url: BC_SERVICE_URL,
  };
}

export function serviceLocationView(
  record: ServiceLocationInput,
  metadata: ServiceLocationMetadata | null,
  now = new Date(),
): ServiceLocationView {
  const safeSource = safeHttps(metadata?.details_source_url)
    ? metadata!.details_source_url!
    : record.sourceUrl;
  const reviewCurrent =
    validDate(metadata?.details_verified_at) &&
    Date.parse(metadata!.details_verified_at!) <= now.getTime() &&
    (record.verified || record.origin === "sample") &&
    (record.sourceId === "service-bc-office-locations"
      ? now.getTime() < Date.parse(BC_REVIEW_EXPIRES_AT)
      : validDate(record.expiresAt) &&
        now.getTime() < Date.parse(record.expiresAt!));
  const field = (summary: string | null | undefined): ServiceFact => ({
    status: !summary?.trim()
      ? "unknown"
      : reviewCurrent
        ? "verified"
        : "stale",
    summary: summary?.trim() || "Check the official source before visiting",
    verifiedAt: summary?.trim() ? metadata?.details_verified_at ?? null : null,
    sourceUrl: safeSource,
  });
  const publicAccess = field(metadata?.public_access_summary);
  const services = field(metadata?.services_summary);
  const hours = field(metadata?.hours_summary);
  const accessibility = field(metadata?.accessibility_summary);
  const address = metadata?.address?.trim() || null;
  const coordinateValid =
    record.coordinates !== null &&
    Number.isFinite(record.coordinates.latitude) &&
    Number.isFinite(record.coordinates.longitude) &&
    record.coordinates.latitude >= -90 &&
    record.coordinates.latitude <= 90 &&
    record.coordinates.longitude >= -180 &&
    record.coordinates.longitude <= 180;
  const pinEligible =
    coordinateValid &&
    !!address &&
    safeHttps(record.sourceUrl) &&
    safeHttps(record.evidenceUrl) &&
    safeHttps(metadata?.details_source_url) &&
    publicAccess.status === "verified" &&
    services.status === "verified" &&
    (record.verified || record.origin === "sample");
  return {
    category: metadata?.service_category ?? "other",
    address,
    publicAccess,
    services,
    hours,
    accessibility,
    pinEligible,
    pinKind: pinEligible
      ? record.origin === "sample"
        ? "sample"
        : "official"
      : null,
  };
}

function validDate(value: string | null | undefined): boolean {
  return !!value && Number.isFinite(Date.parse(value));
}

function safeHttps(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
