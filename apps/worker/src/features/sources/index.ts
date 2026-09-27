import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  getSourceRecord,
  listSourceRecords,
  listSourceRegistry,
} from "@civicresolve/db/d1";
import type {
  OfficialRecordKind,
  SourceRecord,
  SourceRecordWithDetails,
} from "@civicresolve/sources";
import { effectiveListingStatus } from "@civicresolve/sources";
import type { FeatureContext } from "../shared.js";
import { handleSourceCuratorRequest } from "./curator.js";

const COLLECTION_PATH = "/api/v1/sources";
const RECORDS_PATH = "/api/v1/source-records";

export interface SourceRegistryResponse {
  apiVersion: typeof API_VERSION;
  sources: Awaited<ReturnType<typeof listSourceRegistry>>;
  samplesIncluded: boolean;
  policy: {
    samplesAreFictional: true;
    externalSourcesRequireTermsReview: true;
  };
  requestId: string;
}

export async function handleSourceRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  const curatorResponse = await handleSourceCuratorRequest(
    request,
    url,
    context,
  );
  if (curatorResponse) return curatorResponse;
  const sourceRecordResponse = await handleSourceRecordRequest(
    request,
    url,
    context,
  );
  if (sourceRecordResponse) return sourceRecordResponse;
  if (url.pathname !== COLLECTION_PATH) return null;
  if (request.method !== "GET")
    return sourceError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);

  const includeSamples = url.searchParams.get("includeSamples") === "true";
  const sources = await listSourceRegistry(context.env.DB, { includeSamples });
  return sourceJson(context, {
    apiVersion: API_VERSION,
    sources,
    samplesIncluded: includeSamples,
    policy: {
      samplesAreFictional: true,
      externalSourcesRequireTermsReview: true,
    },
    requestId: context.requestId,
  } satisfies SourceRegistryResponse);
}

export async function handleSourceRecordRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (
    url.pathname !== RECORDS_PATH &&
    !url.pathname.startsWith(`${RECORDS_PATH}/`)
  ) {
    return null;
  }
  if (request.method !== "GET")
    return sourceError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);

  const includeSamples = url.searchParams.get("includeSamples") === "true";
  const recordPath = url.pathname.slice(RECORDS_PATH.length);
  if (recordPath === "") {
    const records = await listSourceRecords(context.env.DB, { includeSamples });
    const sourceTerms = await context.env.DB.prepare(
      "SELECT id, terms_status, freshness_state, expires_at FROM source_registry",
    ).all<{
      id: string;
      terms_status: string;
      freshness_state: string;
      expires_at: string | null;
    }>();
    const termsBySource = new Map(
      (sourceTerms.results ?? []).map((source) => [source.id, source]),
    );
    const rightsReviewedRecords = records.filter((record) =>
      record.origin === "sample"
        ? includeSamples
        : (() => {
            const source = termsBySource.get(record.sourceId);
            return (
              source?.terms_status === "permitted" &&
              source.freshness_state === "current" &&
              (!source.expires_at || Date.parse(source.expires_at) > Date.now())
            );
          })(),
    );
    const details = await context.env.DB.prepare(
      `SELECT r.id AS record_id, d.kind, d.latitude, d.longitude,
        l.category AS listing_category, l.posted_date, l.closing_date,
        l.location_text, l.application_status
       FROM source_records AS r
       LEFT JOIN source_record_details AS d ON d.record_id = r.id
       LEFT JOIN source_record_listings AS l ON l.record_id = r.id`,
    ).all<SourceRecordDetailRow>();
    const detailById = new Map(
      (details.results ?? []).map((detail) => [detail.record_id, detail]),
    );
    return sourceJson(context, {
      apiVersion: API_VERSION,
      records: rightsReviewedRecords.map((record) =>
        withDetails(record, detailById.get(record.id)),
      ),
      samplesIncluded: includeSamples,
      policy: {
        sampleRecordsAreFictional: true,
        verifiedRequiresFreshContentAndPermittedTerms: true,
      },
      requestId: context.requestId,
    });
  }

  if (!/^\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(recordPath))
    return sourceError(context, "NOT_FOUND", "Source record not found.", 404);
  const record = await getSourceRecord(context.env.DB, recordPath.slice(1), {
    includeSamples,
  });
  if (!record)
    return sourceError(context, "NOT_FOUND", "Source record not found.", 404);
  if (record.origin !== "sample") {
    const sourceTerms = await context.env.DB.prepare(
      "SELECT terms_status, freshness_state, expires_at FROM source_registry WHERE id = ?",
    )
      .bind(record.sourceId)
      .first<{
        terms_status: string;
        freshness_state: string;
        expires_at: string | null;
      }>();
    const sourceExpiry = sourceTerms?.expires_at
      ? Date.parse(sourceTerms.expires_at)
      : null;
    if (
      sourceTerms?.terms_status !== "permitted" ||
      sourceTerms.freshness_state !== "current" ||
      (sourceExpiry !== null &&
        (!Number.isFinite(sourceExpiry) || sourceExpiry <= Date.now()))
    )
      return sourceError(context, "NOT_FOUND", "Source record not found.", 404);
  }
  const detail = await context.env.DB.prepare(
    `SELECT r.id AS record_id, d.kind, d.latitude, d.longitude,
      l.category AS listing_category, l.posted_date, l.closing_date,
      l.location_text, l.application_status
     FROM source_records AS r
     LEFT JOIN source_record_details AS d ON d.record_id = r.id
     LEFT JOIN source_record_listings AS l ON l.record_id = r.id
     WHERE r.id = ?`,
  )
    .bind(record.id)
    .first<SourceRecordDetailRow>();
  return sourceJson(context, {
    apiVersion: API_VERSION,
    record: withDetails(record, detail),
    requestId: context.requestId,
  });
}

interface SourceRecordDetailRow {
  record_id: string;
  kind: OfficialRecordKind;
  latitude: number | null;
  longitude: number | null;
  listing_category: "job" | "support" | "funding" | null;
  posted_date: string | null;
  closing_date: string | null;
  location_text: string | null;
  application_status: "open" | "closed" | "unknown" | null;
}

function withDetails(
  record: SourceRecord,
  detail: SourceRecordDetailRow | undefined | null,
): SourceRecordWithDetails {
  if (record.origin !== "official_external" || !detail)
    return { ...record, kind: null, coordinates: null, listing: null };
  return {
    ...record,
    kind: detail.kind,
    coordinates:
      typeof detail.latitude === "number" &&
      typeof detail.longitude === "number"
        ? { latitude: detail.latitude, longitude: detail.longitude }
        : null,
    listing: detail.listing_category
      ? {
          category: detail.listing_category,
          postedDate: detail.posted_date,
          closingDate: detail.closing_date,
          locationText: detail.location_text,
          applicationStatus: effectiveListingStatus(record, {
            closingDate: detail.closing_date,
            applicationStatus: detail.application_status ?? "unknown",
          }),
        }
      : null,
  };
}

function sourceJson(
  context: FeatureContext,
  value: unknown,
  status = 200,
): Response {
  const headers = new Headers(context.cors);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { status, headers });
}

function sourceError(
  context: FeatureContext,
  code: string,
  message: string,
  status: number,
): Response {
  return sourceJson(
    context,
    {
      apiVersion: API_VERSION,
      error: { code, message, requestId: context.requestId },
    },
    status,
  );
}
