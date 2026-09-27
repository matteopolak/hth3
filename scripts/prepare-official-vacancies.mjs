#!/usr/bin/env node
// Build the source-backed, one-time D1 import file without exposing an HTTP refresh.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchOfficialRecords } from "../packages/sources/dist/official.js";

const EXPECTED_SOURCES = [
  "federal-student-specialized-inventories",
  "bc-public-service-vacancies",
  "city-ottawa-open-jobs",
  "city-toronto-open-jobs",
];
const output = process.argv[2];
if (!output || process.argv.length !== 3) {
  console.error(
    "Usage: node scripts/prepare-official-vacancies.mjs OUTPUT.sql",
  );
  process.exit(2);
}

const now = new Date();
const result = await fetchOfficialRecords(fetch, now, "vacancies");
const expected = new Set(EXPECTED_SOURCES);
if (
  result.failedSources.length ||
  result.records.length === 0 ||
  result.records.length > 250 ||
  EXPECTED_SOURCES.some(
    (id) =>
      !result.refreshedSourceIds?.includes(id) ||
      !result.records.some((record) => record.sourceId === id),
  ) ||
  result.refreshedSourceIds?.some((id) => !expected.has(id)) ||
  result.records.some((record) => !expected.has(record.sourceId))
) {
  console.error(
    JSON.stringify({
      error: "Incomplete official vacancy scan; no SQL written",
      failures: result.failedSources,
      refreshedSourceIds: result.refreshedSourceIds,
      count: result.records.length,
    }),
  );
  process.exit(1);
}

const ids = new Set();
const externalIds = new Set();
for (const record of result.records) {
  const listing = record.listing;
  const externalKey = `${record.sourceId}:${record.externalId}`;
  if (
    ids.has(record.id) ||
    externalIds.has(externalKey) ||
    record.kind !== null ||
    !record.registry ||
    !record.id.startsWith("official-") ||
    !record.externalId ||
    !listing ||
    listing.category !== "job" ||
    listing.applicationStatus !== "open" ||
    !isHttps(record.sourceUrl) ||
    !isHttps(record.evidenceUrl) ||
    !isHttps(record.registry.url) ||
    !isHttps(record.termsUrl) ||
    !/^[a-f0-9]{64}$/.test(record.payloadHash) ||
    !validInstant(record.fetchedAt) ||
    !validInstant(record.expiresAt) ||
    record.expiresAt <= record.fetchedAt ||
    !validDate(listing.postedDate) ||
    !validDate(listing.closingDate)
  ) {
    throw new Error(`Invalid or duplicate vacancy record: ${record.id}`);
  }
  ids.add(record.id);
  externalIds.add(externalKey);
}

const literal = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value !== "string" || value.includes("\0"))
    throw new Error("Invalid SQL value");
  return `'${value.replaceAll("'", "''")}'`;
};
const values = (...items) => items.map(literal).join(", ");
const statements = [
  "PRAGMA foreign_keys = ON;",
  `-- Official vacancy snapshot prepared ${now.toISOString()}; ${result.records.length} individual postings.`,
];

for (const sourceId of EXPECTED_SOURCES) {
  const records = result.records.filter(
    (record) => record.sourceId === sourceId,
  );
  const first = records[0];
  const expiry = records.reduce(
    (min, record) => (record.expiresAt < min ? record.expiresAt : min),
    first.expiresAt,
  );
  statements.push(
    `-- ${sourceId}: ${records.length} currently verified postings`,
    `INSERT INTO source_registry (
      id, origin, name, publisher, source_url, jurisdiction_level,
      jurisdiction_code, jurisdiction_name, municipality_code, municipality_name,
      licence_name, licence_url, terms_url, terms_status, collection_mode,
      fetched_at, verified_at, expires_at, freshness_state, created_at, updated_at
    ) VALUES (${values(
      sourceId,
      "official_external",
      first.registry.name,
      first.publisher,
      first.registry.url,
      first.jurisdictionLevel,
      first.jurisdictionCode,
      first.jurisdictionName,
      first.municipalityCode ?? null,
      first.municipalityName ?? null,
      first.licenceName,
      first.licenceUrl,
      first.termsUrl,
      "permitted",
      first.registry.collectionMode,
      first.fetchedAt,
      first.fetchedAt,
      expiry,
      "current",
      now.toISOString(),
      now.toISOString(),
    )}) ON CONFLICT(id) DO NOTHING;`,
    `UPDATE source_records SET freshness_state='stale', last_error_code=NULL,
       updated_at=${literal(now.toISOString())}
     WHERE source_id=${literal(sourceId)}
       AND id IN (SELECT record_id FROM source_record_listings);`,
  );

  for (const record of records) {
    statements.push(
      `INSERT INTO source_records (
        id, source_id, origin, external_id, title, summary, source_url,
        publisher, jurisdiction_level, jurisdiction_code, jurisdiction_name,
        municipality_code, municipality_name, licence_name, licence_url,
        terms_url, terms_status, language, fetched_at, verified_at,
        expires_at, payload_hash, evidence_url, freshness_state,
        created_at, updated_at
      ) VALUES (${values(
        record.id,
        sourceId,
        "official_external",
        record.externalId,
        record.title,
        record.summary,
        record.sourceUrl,
        record.publisher,
        record.jurisdictionLevel,
        record.jurisdictionCode,
        record.jurisdictionName,
        record.municipalityCode ?? null,
        record.municipalityName ?? null,
        record.licenceName,
        record.licenceUrl,
        record.termsUrl,
        "permitted",
        record.language,
        record.fetchedAt,
        record.fetchedAt,
        record.expiresAt,
        record.payloadHash,
        record.evidenceUrl,
        "current",
        record.fetchedAt,
        record.fetchedAt,
      )}) ON CONFLICT(id) DO UPDATE SET
        external_id=excluded.external_id, title=excluded.title,
        summary=excluded.summary, source_url=excluded.source_url,
        publisher=excluded.publisher, jurisdiction_level=excluded.jurisdiction_level,
        jurisdiction_code=excluded.jurisdiction_code,
        jurisdiction_name=excluded.jurisdiction_name,
        municipality_code=excluded.municipality_code,
        municipality_name=excluded.municipality_name,
        licence_name=excluded.licence_name, licence_url=excluded.licence_url,
        terms_url=excluded.terms_url, terms_status=excluded.terms_status,
        language=excluded.language, fetched_at=excluded.fetched_at,
        verified_at=excluded.verified_at, expires_at=excluded.expires_at,
        payload_hash=excluded.payload_hash, evidence_url=excluded.evidence_url,
        freshness_state='current', last_error_code=NULL,
        updated_at=excluded.updated_at;`,
      `DELETE FROM source_record_details WHERE record_id=${literal(record.id)};`,
      `INSERT INTO source_record_listings (
        record_id, category, posted_date, closing_date,
        location_text, application_status
      ) VALUES (${values(
        record.id,
        "job",
        record.listing.postedDate,
        record.listing.closingDate,
        record.listing.locationText,
        record.listing.applicationStatus,
      )}) ON CONFLICT(record_id) DO UPDATE SET
        category=excluded.category, posted_date=excluded.posted_date,
        closing_date=excluded.closing_date,
        location_text=excluded.location_text,
        application_status=excluded.application_status;`,
      `INSERT INTO discovery_record_areas (record_id, area)
       VALUES (${values(record.id, "jobs")})
       ON CONFLICT(record_id) DO UPDATE SET area=excluded.area;`,
    );
  }

  statements.push(`UPDATE source_registry SET
    publisher=CASE WHEN json_type(curator_overrides_json, '$.publisher') IS NULL
      THEN ${literal(first.publisher)} ELSE publisher END,
    jurisdiction_level=CASE WHEN json_type(curator_overrides_json, '$.jurisdictionLevel') IS NULL
      THEN ${literal(first.jurisdictionLevel)} ELSE jurisdiction_level END,
    jurisdiction_code=CASE WHEN json_type(curator_overrides_json, '$.jurisdictionCode') IS NULL
      THEN ${literal(first.jurisdictionCode)} ELSE jurisdiction_code END,
    jurisdiction_name=CASE WHEN json_type(curator_overrides_json, '$.jurisdictionName') IS NULL
      THEN ${literal(first.jurisdictionName)} ELSE jurisdiction_name END,
    licence_name=CASE WHEN json_type(curator_overrides_json, '$.licenceName') IS NULL
      THEN ${literal(first.licenceName)} ELSE licence_name END,
    licence_url=CASE WHEN json_type(curator_overrides_json, '$.licenceUrl') IS NULL
      THEN ${literal(first.licenceUrl)} ELSE licence_url END,
    terms_url=CASE WHEN json_type(curator_overrides_json, '$.termsUrl') IS NULL
      THEN ${literal(first.termsUrl)} ELSE terms_url END,
    terms_status=CASE WHEN json_type(curator_overrides_json, '$.termsStatus') IS NULL
      THEN 'permitted' ELSE json_extract(curator_overrides_json, '$.termsStatus') END,
    fetched_at=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL
      THEN ${literal(now.toISOString())} ELSE NULL END,
    verified_at=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL
      THEN ${literal(now.toISOString())} ELSE NULL END,
    expires_at=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL
      THEN ${literal(expiry)} ELSE NULL END,
    freshness_state=CASE WHEN json_type(curator_overrides_json, '$.sourceUrl') IS NULL
      THEN 'current' ELSE 'unknown' END,
    last_error=NULL, version=version+1, updated_at=${literal(now.toISOString())}
    WHERE id=${literal(sourceId)};`);
}

const path = resolve(output);
await writeFile(path, `${statements.join("\n\n")}\n`, { mode: 0o600 });
console.log(
  JSON.stringify({
    output: path,
    count: result.records.length,
    sources: Object.fromEntries(
      EXPECTED_SOURCES.map((id) => [
        id,
        result.records.filter((record) => record.sourceId === id).length,
      ]),
    ),
    expiresFirst: result.records.reduce(
      (min, record) => (record.expiresAt < min ? record.expiresAt : min),
      result.records[0].expiresAt,
    ),
  }),
);

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validInstant(value) {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function validDate(value) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
