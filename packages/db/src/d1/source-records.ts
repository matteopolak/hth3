import {
  toSourceRecord,
  type SourceRecord,
  type SourceRecordRow,
} from "@civicresolve/sources";
import type { D1Database } from "./types.js";

const SOURCE_RECORD_COLUMNS = `
  id, source_id, origin, external_id, title, summary, source_url, publisher,
  jurisdiction_level, jurisdiction_code, jurisdiction_name,
  municipality_code, municipality_name, licence_name, licence_url, terms_url,
  terms_status, language, fetched_at, verified_at, expires_at, payload_hash,
  evidence_url, freshness_state, last_error_code, sample_label`;

const PUBLIC_SOURCE_RECORD_PREDICATE = `
  ((origin = 'sample' AND ? = 1)
   OR (origin <> 'sample' AND terms_status = 'permitted'))`;

export async function listSourceRecords(
  database: D1Database,
  options: { includeSamples?: boolean } = {},
): Promise<SourceRecord[]> {
  const result = await database
    .prepare(
      `SELECT ${SOURCE_RECORD_COLUMNS} FROM source_records
       WHERE ${PUBLIC_SOURCE_RECORD_PREDICATE}
       ORDER BY jurisdiction_name, title, id`,
    )
    .bind(options.includeSamples ? 1 : 0)
    .all<SourceRecordRow>();
  return (result.results ?? []).map((row) => toSourceRecord(row));
}

export async function getSourceRecord(
  database: D1Database,
  id: string,
  options: { includeSamples?: boolean } = {},
): Promise<SourceRecord | null> {
  const result = await database
    .prepare(
      `SELECT ${SOURCE_RECORD_COLUMNS} FROM source_records
       WHERE id = ? AND ${PUBLIC_SOURCE_RECORD_PREDICATE}`,
    )
    .bind(id, options.includeSamples ? 1 : 0)
    .first<SourceRecordRow>();
  return result ? toSourceRecord(result) : null;
}
