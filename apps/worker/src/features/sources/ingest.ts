import { type D1Database } from "@civicresolve/db/d1";
import {
  fetchOfficialRecords,
  type OfficialIngestRecord,
} from "@civicresolve/sources";

/** Call from a trusted scheduled event or operator task. This is deliberately not a public HTTP route. */
export async function ingestOfficialSources(
  database: D1Database,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<{
  imported: number;
  failures: { sourceId: string; code: string }[];
}> {
  const result = await fetchOfficialRecords(fetcher, now);
  const bySource = new Map<string, OfficialIngestRecord[]>();
  for (const record of result.records) {
    const existing = bySource.get(record.sourceId) ?? [];
    existing.push(record);
    bySource.set(record.sourceId, existing);
  }

  for (const [sourceId, records] of bySource) {
    if (sourceId === "service-bc-office-locations") {
      await database
        .prepare(
          "UPDATE source_records SET freshness_state='stale', updated_at=? WHERE source_id=?",
        )
        .bind(now.toISOString(), sourceId)
        .run();
    }
    for (const record of records) {
      const imported = await database
        .prepare(
          `
        INSERT INTO source_records (
          id, source_id, origin, external_id, title, summary, source_url,
          publisher, jurisdiction_level, jurisdiction_code, jurisdiction_name,
          licence_name, licence_url, terms_url, terms_status, language,
          fetched_at, verified_at, expires_at, payload_hash, evidence_url,
          freshness_state, created_at, updated_at
        ) VALUES (?, ?, 'official_external', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'permitted', ?, ?, ?, ?, ?, ?, 'current', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          external_id=excluded.external_id, title=excluded.title,
          summary=excluded.summary, source_url=excluded.source_url,
          publisher=excluded.publisher,
          jurisdiction_level=excluded.jurisdiction_level,
          jurisdiction_code=excluded.jurisdiction_code,
          jurisdiction_name=excluded.jurisdiction_name,
          licence_name=excluded.licence_name,
          licence_url=excluded.licence_url, terms_url=excluded.terms_url,
          terms_status=excluded.terms_status, language=excluded.language,
          fetched_at=excluded.fetched_at, verified_at=excluded.verified_at,
          expires_at=excluded.expires_at, payload_hash=excluded.payload_hash,
          evidence_url=excluded.evidence_url,
          freshness_state='current',
          last_error_code=NULL, updated_at=excluded.updated_at
      `,
        )
        .bind(
          record.id,
          sourceId,
          record.externalId,
          record.title,
          record.summary,
          record.sourceUrl,
          record.publisher,
          record.jurisdictionLevel,
          record.jurisdictionCode,
          record.jurisdictionName,
          record.licenceName,
          record.licenceUrl,
          record.termsUrl,
          record.language,
          record.fetchedAt,
          record.fetchedAt,
          record.expiresAt,
          record.payloadHash,
          record.evidenceUrl,
          record.fetchedAt,
          record.fetchedAt,
        )
        .run();
      if (!imported.success)
        throw new Error(
          `Could not persist official source record ${record.id}`,
        );

      if (record.kind !== null) {
        const detail = await database
          .prepare(
            `
        INSERT INTO source_record_details (record_id, kind, latitude, longitude)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(record_id) DO UPDATE SET kind=excluded.kind,
          latitude=excluded.latitude, longitude=excluded.longitude
      `,
          )
          .bind(record.id, record.kind, record.latitude, record.longitude)
          .run();
        if (!detail.success)
          throw new Error(
            `Could not persist official source details ${record.id}`,
          );
      }
      const area = areaForRecord(record);
      await database
        .prepare(
          `INSERT INTO discovery_record_areas (record_id, area) VALUES (?, ?)
           ON CONFLICT(record_id) DO UPDATE SET area=excluded.area`,
        )
        .bind(record.id, area)
        .run();
    }

    const latestExpiry = records.reduce(
      (value, record) => (record.expiresAt < value ? record.expiresAt : value),
      records[0]!.expiresAt,
    );
    const sourceRecord = records[0]!;
    const existingSource = await database
      .prepare(
        `SELECT publisher, jurisdiction_level, jurisdiction_code,
           jurisdiction_name, licence_name, licence_url, terms_url,
           curator_overrides_json FROM source_registry WHERE id = ?`,
      )
      .bind(sourceId)
      .first<{
        publisher: string;
        jurisdiction_level: string;
        jurisdiction_code: string;
        jurisdiction_name: string;
        licence_name: string | null;
        licence_url: string | null;
        terms_url: string | null;
        curator_overrides_json: string;
      }>();
    const overrides = JSON.parse(
      existingSource?.curator_overrides_json ?? "{}",
    ) as Record<string, unknown>;
    const refreshedMetadata = [
      ["publisher", "publisher", sourceRecord.publisher],
      [
        "jurisdictionLevel",
        "jurisdiction_level",
        sourceRecord.jurisdictionLevel,
      ],
      ["jurisdictionCode", "jurisdiction_code", sourceRecord.jurisdictionCode],
      ["jurisdictionName", "jurisdiction_name", sourceRecord.jurisdictionName],
      ["licenceName", "licence_name", sourceRecord.licenceName],
      ["licenceUrl", "licence_url", sourceRecord.licenceUrl],
      ["termsUrl", "terms_url", sourceRecord.termsUrl],
    ] as const;
    const metadataChanged = refreshedMetadata.some(
      ([overrideKey, column, value]) =>
        !Object.hasOwn(overrides, overrideKey) &&
        existingSource?.[column] !== value,
    );
    const source = await database
      .prepare(
        `
      UPDATE source_registry SET
        publisher=CASE WHEN json_type(curator_overrides_json, '$.publisher') IS NULL THEN ? ELSE publisher END,
        jurisdiction_level=CASE WHEN json_type(curator_overrides_json, '$.jurisdictionLevel') IS NULL THEN ? ELSE jurisdiction_level END,
        jurisdiction_code=CASE WHEN json_type(curator_overrides_json, '$.jurisdictionCode') IS NULL THEN ? ELSE jurisdiction_code END,
        jurisdiction_name=CASE WHEN json_type(curator_overrides_json, '$.jurisdictionName') IS NULL THEN ? ELSE jurisdiction_name END,
        licence_name=CASE WHEN json_type(curator_overrides_json, '$.licenceName') IS NULL THEN ? ELSE licence_name END,
        licence_url=CASE WHEN json_type(curator_overrides_json, '$.licenceUrl') IS NULL THEN ? ELSE licence_url END,
        terms_url=CASE WHEN json_type(curator_overrides_json, '$.termsUrl') IS NULL THEN ? ELSE terms_url END,
        terms_status=CASE
          WHEN json_type(curator_overrides_json, '$.termsStatus') IS NULL THEN 'permitted'
          ELSE json_extract(curator_overrides_json, '$.termsStatus')
        END,
        fetched_at=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL THEN ? ELSE NULL END,
        verified_at=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL THEN ? ELSE NULL END,
        expires_at=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL THEN ? ELSE NULL END,
        freshness_state=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL THEN 'current' ELSE 'unknown' END,
        last_error=NULL, version=version + ?, updated_at=? WHERE id=?
    `,
      )
      .bind(
        sourceRecord.publisher,
        sourceRecord.jurisdictionLevel,
        sourceRecord.jurisdictionCode,
        sourceRecord.jurisdictionName,
        sourceRecord.licenceName,
        sourceRecord.licenceUrl,
        sourceRecord.termsUrl,
        now.toISOString(),
        now.toISOString(),
        latestExpiry,
        metadataChanged ? 1 : 0,
        now.toISOString(),
        sourceId,
      )
      .run();
    if (!source.success)
      throw new Error(`Could not persist official source ${sourceId}`);
  }

  for (const failure of result.failedSources) {
    const state = await database
      .prepare(
        `
      UPDATE source_registry SET freshness_state='error', last_error=?,
        updated_at=? WHERE id=?
    `,
      )
      .bind(failure.code, now.toISOString(), failure.sourceId)
      .run();
    if (!state.success)
      throw new Error(`Could not persist source failure ${failure.sourceId}`);
    await database
      .prepare(
        `
      UPDATE source_records SET freshness_state='error', last_error_code=?,
        updated_at=? WHERE source_id=?
    `,
      )
      .bind(failure.code, now.toISOString(), failure.sourceId)
      .run();
  }

  return { imported: result.records.length, failures: result.failedSources };
}

function areaForRecord(
  record: OfficialIngestRecord,
): "jobs" | "support" | "funding" | "nearby" | "participation" {
  if (record.kind === "jobs_finder") return "jobs";
  if (record.kind === "benefits_finder") return "support";
  if (record.kind === "funding_finder") return "funding";
  if (record.kind === "service_location") return "nearby";
  if (
    record.sourceId === "federal-service-canada-offices" ||
    record.sourceId === "serviceontario-location-finder"
  )
    return "nearby";
  return "participation";
}
