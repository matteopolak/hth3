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
  selection: "all" | "vacancies" = "all",
): Promise<{
  imported: number;
  failures: { sourceId: string; code: string }[];
}> {
  const result = await fetchOfficialRecords(fetcher, now, selection);
  const bySource = new Map<string, OfficialIngestRecord[]>();
  for (const record of result.records) {
    const existing = bySource.get(record.sourceId) ?? [];
    existing.push(record);
    bySource.set(record.sourceId, existing);
  }

  for (const sourceId of new Set(result.refreshedSourceIds ?? [])) {
    await database
      .prepare(
        `UPDATE source_records SET freshness_state='stale', last_error_code=NULL,
           updated_at=?
         WHERE source_id=? AND id IN (SELECT record_id FROM source_record_listings)`,
      )
      .bind(now.toISOString(), sourceId)
      .run();
  }

  for (const [sourceId, records] of bySource) {
    const sourceRecord = records[0]!;
    await ensureSourceRegistered(database, sourceRecord, now);
    if (sourceId === "service-bc-office-locations") {
      await database
        .prepare(
          "UPDATE source_records SET freshness_state='stale', updated_at=? WHERE source_id=?",
        )
        .bind(now.toISOString(), sourceId)
        .run();
    }
    for (const record of records) {
      if (record.listing) validateListing(record);
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

      if (record.municipalityCode || record.municipalityName) {
        if (!record.municipalityCode || !record.municipalityName)
          throw new Error(`Incomplete municipality for ${record.id}`);
        await database
          .prepare(
            `UPDATE source_records SET municipality_code=?, municipality_name=?
             WHERE id=?`,
          )
          .bind(record.municipalityCode, record.municipalityName, record.id)
          .run();
      }

      if (record.listing) {
        await database
          .prepare("DELETE FROM source_record_details WHERE record_id=?")
          .bind(record.id)
          .run();
        const listing = await database
          .prepare(
            `INSERT INTO source_record_listings
              (record_id, category, posted_date, closing_date,
               location_text, application_status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(record_id) DO UPDATE SET
               category=excluded.category, posted_date=excluded.posted_date,
               closing_date=excluded.closing_date,
               location_text=excluded.location_text,
               application_status=excluded.application_status`,
          )
          .bind(
            record.id,
            record.listing.category,
            record.listing.postedDate,
            record.listing.closingDate,
            record.listing.locationText,
            record.listing.applicationStatus,
          )
          .run();
        if (!listing.success)
          throw new Error(`Could not persist source listing ${record.id}`);
      }

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
  if (record.listing?.category === "job") return "jobs";
  if (record.listing?.category === "support") return "support";
  if (record.listing?.category === "funding") return "funding";
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

async function ensureSourceRegistered(
  database: D1Database,
  record: OfficialIngestRecord,
  now: Date,
): Promise<void> {
  const existing = await database
    .prepare("SELECT id FROM source_registry WHERE id=?")
    .bind(record.sourceId)
    .first<{ id: string }>();
  if (existing) return;
  const registry = record.registry;
  if (!registry || !registry.url.startsWith("https://"))
    throw new Error(`Source registry metadata missing for ${record.sourceId}`);
  await database
    .prepare(
      `INSERT INTO source_registry (
        id, origin, name, publisher, source_url, jurisdiction_level,
        jurisdiction_code, jurisdiction_name, municipality_code,
        municipality_name, licence_name, licence_url, terms_url,
        terms_status, collection_mode, fetched_at, verified_at,
        expires_at, freshness_state, created_at, updated_at
      ) VALUES (?, 'official_external', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'permitted', ?, ?, ?, ?, 'current', ?, ?)`,
    )
    .bind(
      record.sourceId,
      registry.name,
      record.publisher,
      registry.url,
      record.jurisdictionLevel,
      record.jurisdictionCode,
      record.jurisdictionName,
      record.municipalityCode ?? null,
      record.municipalityName ?? null,
      record.licenceName,
      record.licenceUrl,
      record.termsUrl,
      registry.collectionMode,
      record.fetchedAt,
      record.fetchedAt,
      record.expiresAt,
      now.toISOString(),
      now.toISOString(),
    )
    .run();
}

function validateListing(record: OfficialIngestRecord): void {
  const listing = record.listing!;
  if (
    record.kind !== null ||
    !record.externalId ||
    !record.sourceUrl.startsWith("https://") ||
    !record.evidenceUrl.startsWith("https://") ||
    !/^[a-f0-9]{64}$/.test(record.payloadHash) ||
    !["job", "support", "funding"].includes(listing.category) ||
    !["open", "closed", "unknown"].includes(listing.applicationStatus) ||
    !validDate(listing.postedDate) ||
    !validDate(listing.closingDate)
  )
    throw new Error(`Invalid source listing ${record.id}`);
}

function validDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
