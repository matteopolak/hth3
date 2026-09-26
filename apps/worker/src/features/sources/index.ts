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
import type { FeatureContext } from "../shared.js";

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
    const details = await context.env.DB.prepare(
      "SELECT record_id, kind, latitude, longitude FROM source_record_details",
    ).all<SourceRecordDetailRow>();
    const detailById = new Map(
      (details.results ?? []).map((detail) => [detail.record_id, detail]),
    );
    return sourceJson(context, {
      apiVersion: API_VERSION,
      records: records.map((record) =>
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
  const detail = await context.env.DB.prepare(
    "SELECT record_id, kind, latitude, longitude FROM source_record_details WHERE record_id = ?",
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
}

function withDetails(
  record: SourceRecord,
  detail: SourceRecordDetailRow | undefined | null,
): SourceRecordWithDetails {
  if (record.origin !== "official_external" || !detail)
    return { ...record, kind: null, coordinates: null };
  return {
    ...record,
    kind: detail.kind,
    coordinates:
      typeof detail.latitude === "number" &&
      typeof detail.longitude === "number"
        ? { latitude: detail.latitude, longitude: detail.longitude }
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
