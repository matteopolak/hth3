import {
  toSourceRegistryEntry,
  type SourceRegistryEntry,
  type SourceRegistryRow,
} from "@civicresolve/sources";
import type { D1Database } from "./types.js";

const SOURCE_COLUMNS = `
  id, origin, name, publisher, source_url, jurisdiction_level,
  jurisdiction_code, jurisdiction_name, municipality_code, municipality_name,
  licence_name, licence_url, terms_url, terms_status, collection_mode,
  fetched_at, verified_at, expires_at, freshness_state, last_error, sample_label`;

export async function listSourceRegistry(
  database: D1Database,
  options: { includeSamples?: boolean } = {},
): Promise<SourceRegistryEntry[]> {
  const query = options.includeSamples
    ? `SELECT ${SOURCE_COLUMNS} FROM source_registry ORDER BY origin, name`
    : `SELECT ${SOURCE_COLUMNS} FROM source_registry WHERE origin <> 'sample' ORDER BY origin, name`;
  const result = await database.prepare(query).all<SourceRegistryRow>();
  return (result.results ?? []).map(toSourceRegistryEntry);
}
