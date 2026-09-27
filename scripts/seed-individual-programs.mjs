#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pack = JSON.parse(
  readFileSync(resolve(root, "data/individual-program-pack.json"), "utf8"),
);
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const targetIndex = args.indexOf("--target");
const apply = args.includes("--apply");
const target = targetIndex < 0 ? null : args[targetIndex + 1];
if (
  (outIndex < 0 && !apply) ||
  (outIndex >= 0 && !args[outIndex + 1]) ||
  (apply && !["local", "production"].includes(target)) ||
  (targetIndex >= 0 && !apply) ||
  args.length !==
    (outIndex >= 0 ? 2 : 0) + (targetIndex >= 0 ? 2 : 0) + (apply ? 1 : 0)
) {
  console.error(
    "Usage: node scripts/seed-individual-programs.mjs [--out path.sql] [--target local|production --apply]",
  );
  process.exit(2);
}

const quote = (value) =>
  value === null || value === undefined
    ? "NULL"
    : `'${String(value).replaceAll("'", "''")}'`;
const values = (...items) => `(${items.map(quote).join(", ")})`;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const url = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const checkedAt = pack.checkedAt;
const expiresAt = pack.expiresAt;
if (
  !Number.isFinite(Date.parse(checkedAt)) ||
  !Number.isFinite(Date.parse(expiresAt)) ||
  Date.parse(expiresAt) <= Date.parse(checkedAt)
) {
  throw new Error("Invalid pack review window");
}

const sql = [
  "PRAGMA foreign_keys = ON;",
  "-- Direct official program links checked on the date stored in individual-program-pack.json.",
  "-- Link metadata and short original summaries only; no publisher prose is republished.",
];
const ids = new Set();
for (const item of pack.records) {
  if (
    !/^[a-z0-9-]+$/.test(item.id) ||
    ids.has(item.id) ||
    !["funding", "support"].includes(item.category) ||
    !url(item.url) ||
    !url(item.termsUrl) ||
    !["federal", "provincial"].includes(item.jurisdiction?.level) ||
    !["CA", "CA-BC", "CA-ON"].includes(item.jurisdiction?.code) ||
    !["open", "closed", "unknown"].includes(item.applicationStatus) ||
    (item.applicationStatus !== "unknown" && !item.statusEvidence) ||
    (item.closingDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(item.closingDate))
  ) {
    throw new Error(`Invalid program record: ${item.id}`);
  }
  ids.add(item.id);
  const sourceId = `manual-program-${item.id}`;
  const recordId = `official-program-${item.id}`;
  const j = item.jurisdiction;
  const payloadHash = hash(JSON.stringify(item));
  sql.push(
    `INSERT INTO source_registry (id, origin, name, publisher, source_url, jurisdiction_level, jurisdiction_code, jurisdiction_name, terms_url, terms_status, collection_mode, fetched_at, verified_at, expires_at, freshness_state, created_at, updated_at) VALUES ${values(sourceId, "official_external", item.title, item.publisher, item.url, j.level, j.code, j.name, item.termsUrl, "permitted", "manual", checkedAt, checkedAt, expiresAt, "current", checkedAt, checkedAt)} ON CONFLICT(id) DO UPDATE SET name=excluded.name, publisher=excluded.publisher, source_url=excluded.source_url, jurisdiction_level=excluded.jurisdiction_level, jurisdiction_code=excluded.jurisdiction_code, jurisdiction_name=excluded.jurisdiction_name, terms_url=excluded.terms_url, terms_status=excluded.terms_status, fetched_at=excluded.fetched_at, verified_at=excluded.verified_at, expires_at=excluded.expires_at, freshness_state=excluded.freshness_state, updated_at=excluded.updated_at, last_error=NULL;`,
  );
  sql.push(
    `INSERT INTO source_records (id, source_id, origin, external_id, title, summary, source_url, publisher, jurisdiction_level, jurisdiction_code, jurisdiction_name, terms_url, terms_status, language, fetched_at, verified_at, expires_at, payload_hash, evidence_url, freshness_state, created_at, updated_at) VALUES ${values(recordId, sourceId, "official_external", item.url, item.title, item.summary, item.url, item.publisher, j.level, j.code, j.name, item.termsUrl, "permitted", "en", checkedAt, checkedAt, expiresAt, payloadHash, item.url, "current", checkedAt, checkedAt)} ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, external_id=excluded.external_id, title=excluded.title, summary=excluded.summary, source_url=excluded.source_url, publisher=excluded.publisher, jurisdiction_level=excluded.jurisdiction_level, jurisdiction_code=excluded.jurisdiction_code, jurisdiction_name=excluded.jurisdiction_name, terms_url=excluded.terms_url, terms_status=excluded.terms_status, language=excluded.language, fetched_at=excluded.fetched_at, verified_at=excluded.verified_at, expires_at=excluded.expires_at, payload_hash=excluded.payload_hash, evidence_url=excluded.evidence_url, freshness_state=excluded.freshness_state, updated_at=excluded.updated_at, last_error_code=NULL;`,
  );
  sql.push(
    `INSERT INTO source_record_listings (record_id, category, posted_date, closing_date, location_text, application_status) VALUES ${values(recordId, item.category, null, item.closingDate, null, item.applicationStatus)} ON CONFLICT(record_id) DO UPDATE SET category=excluded.category, closing_date=excluded.closing_date, application_status=excluded.application_status;`,
  );
  sql.push(
    `INSERT INTO discovery_record_areas (record_id, area) VALUES ${values(recordId, item.category)} ON CONFLICT(record_id) DO UPDATE SET area=excluded.area;`,
  );
}

for (const item of pack.existingRecords) {
  if (
    !/^[a-z0-9-]+$/.test(item.id) ||
    ids.has(item.id) ||
    !["funding", "support"].includes(item.category)
  ) {
    throw new Error(`Invalid existing program reference: ${item.id}`);
  }
  ids.add(item.id);
  const recordId = `official-manual-${item.id}`;
  sql.push(
    `INSERT INTO source_record_listings (record_id, category, posted_date, closing_date, location_text, application_status) SELECT id, ${quote(item.category)}, NULL, NULL, NULL, 'unknown' FROM source_records WHERE id=${quote(recordId)} ON CONFLICT(record_id) DO UPDATE SET category=excluded.category;`,
  );
}

const sqlText = `${sql.join("\n")}\n`;
const output = outIndex < 0 ? null : resolve(args[outIndex + 1]);
if (output) writeFileSync(output, sqlText);
console.log(
  JSON.stringify({
    directPrograms: pack.records.length,
    existingProgramDetails: pack.existingRecords.length,
    checkedAt,
    expiresAt,
    output,
    applied: apply ? target : null,
  }),
);

if (apply) {
  const temp = mkdtempSync(join(tmpdir(), "envoy-programs-"));
  try {
    const file = join(temp, "seed.sql");
    writeFileSync(file, sqlText);
    const command = [
      "d1",
      "execute",
      target === "production" ? "civicresolve-prod" : "civicresolve-local",
      target === "production" ? "--remote" : "--local",
      "--file",
      file,
    ];
    if (target === "production") command.push("--env", "production");
    const result = spawnSync(
      join(root, "apps/worker/node_modules/.bin/wrangler"),
      command,
      { cwd: join(root, "apps/worker"), stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
