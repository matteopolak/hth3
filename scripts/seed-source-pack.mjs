#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pack = JSON.parse(readFileSync(join(root, "data/official-source-pack.json"), "utf8"));
const practice = JSON.parse(readFileSync(join(root, "data/practice-civic-issues.json"), "utf8"));
const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const target = args.includes("--target") ? valueAfter("--target") : undefined;
const out = args.includes("--out") ? valueAfter("--out") : undefined;
const apply = args.includes("--apply");
if (args.includes("--help") || (apply && !["local", "production"].includes(target)) || (args.includes("--target") && !["local", "production"].includes(target))) {
  console.log("Usage: node scripts/seed-source-pack.mjs [--out /tmp/source-pack.sql] [--target local|production --apply]");
  process.exit(args.includes("--help") ? 0 : 2);
}

const quote = (value) => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const row = (columns, values) => `(${columns.join(", ")}) VALUES (${values.map(quote).join(", ")})`;
const updateFromExcluded = (columns) => columns
  .filter((column) => column !== "id" && column !== "created_at")
  .map((column) => `${column}=excluded.${column}`)
  .join(", ");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const now = new Date().toISOString();
const current = Date.parse(pack.expiresAt) > Date.now();
const freshness = current ? "current" : "stale";
const sql = ["PRAGMA foreign_keys = ON;"];
const seen = new Set();

for (const item of pack.records) {
  if (seen.has(item.id) || !/^https:\/\//.test(item.url) || !/^https:\/\//.test(item.termsUrl) || !["jobs", "support", "funding", "nearby", "participation"].includes(item.area)) {
    throw new Error(`Invalid or duplicate official record: ${item.id}`);
  }
  seen.add(item.id);
  const sourceId = `manual-${item.id}`;
  const recordId = `official-manual-${item.id}`;
  const checkedAt = item.checkedAt ?? pack.checkedAt;
  const expiresAt = item.expiresAt ?? pack.expiresAt;
  const itemFreshness = Date.parse(expiresAt) > Date.now() ? "current" : "stale";
  if (!Number.isFinite(Date.parse(checkedAt)) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(checkedAt)) {
    throw new Error(`Invalid review dates: ${item.id}`);
  }
  const j = item.jurisdiction;
  const base = [item.title, item.publisher, item.url, j.level, j.code, j.name, j.municipalityCode ?? null, j.municipalityName ?? null, item.termsUrl];
  const registryColumns = ["id", "origin", "name", "publisher", "source_url", "jurisdiction_level", "jurisdiction_code", "jurisdiction_name", "municipality_code", "municipality_name", "terms_url", "terms_status", "collection_mode", "verified_at", "expires_at", "freshness_state", "created_at", "updated_at"];
  sql.push(`INSERT INTO source_registry ${row(
    registryColumns,
    [sourceId, "official_external", ...base, "permitted", "manual", checkedAt, expiresAt, itemFreshness, now, now],
  )} ON CONFLICT(id) DO UPDATE SET ${updateFromExcluded(registryColumns)}, last_error=NULL;`);
  const recordColumns = ["id", "source_id", "origin", "external_id", "title", "summary", "source_url", "publisher", "jurisdiction_level", "jurisdiction_code", "jurisdiction_name", "municipality_code", "municipality_name", "terms_url", "terms_status", "language", "verified_at", "expires_at", "payload_hash", "evidence_url", "freshness_state", "created_at", "updated_at"];
  sql.push(`INSERT INTO source_records ${row(
    recordColumns,
    [recordId, sourceId, "official_external", item.url, item.title, item.summary, item.url, item.publisher, j.level, j.code, j.name, j.municipalityCode ?? null, j.municipalityName ?? null, item.termsUrl, "permitted", "en", checkedAt, expiresAt, sha256(JSON.stringify(item)), item.url, itemFreshness, now, now],
  )} ON CONFLICT(id) DO UPDATE SET ${updateFromExcluded(recordColumns)}, last_error_code=NULL;`);
  if (item.kind) {
    const coordinates = item.coordinates;
    if (coordinates && (item.kind !== "service_location" || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude) || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180)) {
      throw new Error(`Invalid coordinates: ${item.id}`);
    }
    sql.push(`INSERT INTO source_record_details ${row(["record_id", "kind", "latitude", "longitude"], [recordId, item.kind, coordinates?.latitude ?? null, coordinates?.longitude ?? null])} ON CONFLICT(record_id) DO UPDATE SET kind=excluded.kind, latitude=excluded.latitude, longitude=excluded.longitude;`);
  }
  if (item.area === "nearby") {
    const categories = ["government", "library", "community", "transit", "other"];
    if (item.kind !== "service_location" || !categories.includes(item.serviceCategory) || !item.address || !item.publicAccessSummary || !item.servicesSummary || !/^https:\/\//.test(item.detailsSourceUrl) || !Number.isFinite(Date.parse(item.detailsCheckedAt)) || Date.parse(item.detailsCheckedAt) > Date.parse(expiresAt) || (item.coordinates && !/^https:\/\//.test(item.coordinatesEvidenceUrl)) || (item.mapLocationPrecision && !["site", "station"].includes(item.mapLocationPrecision))) {
      throw new Error(`Incomplete service location evidence: ${item.id}`);
    }
    sql.push(`INSERT INTO service_location_metadata ${row(
      ["record_id", "service_category", "address", "public_access_summary", "services_summary", "hours_summary", "accessibility_summary", "details_verified_at", "details_source_url", "coordinates_source_url", "map_location_precision"],
      [recordId, item.serviceCategory, item.address, item.publicAccessSummary, item.servicesSummary, item.hoursSummary ?? null, item.accessibilitySummary ?? null, item.detailsCheckedAt, item.detailsSourceUrl, item.coordinatesEvidenceUrl ?? null, item.mapLocationPrecision ?? "site"],
    )} ON CONFLICT(record_id) DO UPDATE SET service_category=excluded.service_category, address=excluded.address, public_access_summary=excluded.public_access_summary, services_summary=excluded.services_summary, hours_summary=excluded.hours_summary, accessibility_summary=excluded.accessibility_summary, details_verified_at=excluded.details_verified_at, details_source_url=excluded.details_source_url, coordinates_source_url=excluded.coordinates_source_url, map_location_precision=excluded.map_location_precision;`);
  }
  sql.push(`INSERT INTO discovery_record_areas ${row(["record_id", "area"], [recordId, item.area])} ON CONFLICT(record_id) DO UPDATE SET area=excluded.area;`);
}

if (!practice.sample || practice.organizationId !== "org_43G1B1RhPwac7EjS" || practice.municipality.csdUid !== "3520005") {
  throw new Error("Practice pack must remain in the fictional Toronto workspace.");
}
for (const issue of practice.issues) {
  if (!issue.text.startsWith("[Practice] ")) throw new Error(`Unlabelled practice issue: ${issue.id}`);
  // No raw receipt token is saved or printed. The random hash is only used on first insert.
  const receiptHash = sha256(randomBytes(32));
  sql.push(`INSERT OR IGNORE INTO feedback_submissions ${row(
    ["id", "original_text", "status", "receipt_token_hash", "sample", "created_at", "updated_at", "organization_id", "municipality_csd_uid", "category", "taxonomy_version_id", "category_id", "intent", "classification_review_status"],
    [issue.id, issue.text, issue.status, receiptHash, 1, issue.createdAt, issue.createdAt, practice.organizationId, practice.municipality.csdUid, issue.category, "taxv_toronto_1", issue.categoryId, issue.intent, "needs_review"],
  )};`);
  sql.push(`INSERT OR IGNORE INTO feedback_messages ${row(
    ["id", "submission_id", "author_kind", "body", "created_at"],
    [`${issue.id}-initial`, issue.id, "resident", issue.text, issue.createdAt],
  )};`);
}
const sqlText = `${sql.join("\n")}\n`;

if (out) writeFileSync(resolve(out), sqlText);
console.log(JSON.stringify({ officialRecords: pack.records.length, byArea: Object.fromEntries(["jobs", "funding", "support", "nearby", "participation"].map((area) => [area, pack.records.filter((r) => r.area === area).length])), practiceIssues: practice.issues.length, checkedAt: pack.checkedAt, freshness, output: out ?? null, applied: apply ? target : null }));

if (apply) {
  const temp = mkdtempSync(join(tmpdir(), "envoy-source-pack-"));
  const file = join(temp, "seed.sql");
  writeFileSync(file, sqlText);
  try {
    const command = ["d1", "execute", target === "production" ? "civicresolve-prod" : "civicresolve-local", target === "production" ? "--remote" : "--local", "--file", file];
    if (target === "production") command.push("--env", "production");
    const result = spawnSync(join(root, "apps/worker/node_modules/.bin/wrangler"), command, { cwd: join(root, "apps/worker"), stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
