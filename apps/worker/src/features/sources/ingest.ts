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
          summary=excluded.summary,
          publisher=excluded.publisher, licence_name=excluded.licence_name,
          licence_url=excluded.licence_url, terms_url=excluded.terms_url,
          fetched_at=excluded.fetched_at, verified_at=excluded.verified_at,
          expires_at=excluded.expires_at, payload_hash=excluded.payload_hash,
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
    }

    const latestExpiry = records.reduce(
      (value, record) => (record.expiresAt < value ? record.expiresAt : value),
      records[0]!.expiresAt,
    );
    const source = await database
      .prepare(
        `
      UPDATE source_registry SET terms_status='permitted', fetched_at=?,
        verified_at=?, expires_at=?, freshness_state='current',
        last_error=NULL, updated_at=? WHERE id=?
    `,
      )
      .bind(
        now.toISOString(),
        now.toISOString(),
        latestExpiry,
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
