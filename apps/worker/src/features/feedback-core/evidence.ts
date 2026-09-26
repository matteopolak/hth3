import {
  canReadPrivateAsset,
  privateAssetKey,
  readPrivateAsset,
  type D1Database,
  type D1PreparedStatement,
  type PrivateAssetMetadata,
  type PrivateAssetScope,
  type R2Bucket,
} from "@civicresolve/db/d1";
import { stableId } from "./common.js";
import type {
  EvidenceInput,
  EvidenceMetadata,
  FeedbackContext,
  PrivateAssetRow,
} from "./types.js";
import {
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_FILES,
  MAX_TOTAL_EVIDENCE_BYTES,
} from "./types.js";

interface ValidatedEvidence {
  fileName: string;
  contentType: EvidenceInput["contentType"];
  data: Uint8Array;
  digest: string;
}

interface StoredEvidence {
  metadata: EvidenceMetadata;
  row: PrivateAssetRow;
  scope: PrivateAssetScope;
}

export class InvalidEvidenceError extends Error {
  constructor() {
    super(
      "Evidence must be a supported PDF, PNG, or JPEG under the size limit.",
    );
    this.name = "InvalidEvidenceError";
  }
}

export class EvidenceStorageUnavailableError extends Error {
  constructor() {
    super("Private evidence storage is unavailable.");
    this.name = "EvidenceStorageUnavailableError";
  }
}

export async function validateEvidence(
  value: unknown,
): Promise<ValidatedEvidence[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_EVIDENCE_FILES)
    throw new InvalidEvidenceError();

  let totalBytes = 0;
  const files: ValidatedEvidence[] = [];
  for (const input of value) {
    if (!isEvidenceInput(input)) throw new InvalidEvidenceError();
    const bytes = decodeBase64(input.data);
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > MAX_EVIDENCE_BYTES ||
      !matchesContentType(input.contentType, bytes)
    ) {
      throw new InvalidEvidenceError();
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_EVIDENCE_BYTES) throw new InvalidEvidenceError();
    const fileName = safeFileName(input.fileName);
    if (!fileName) throw new InvalidEvidenceError();
    files.push({
      fileName,
      contentType: input.contentType,
      data: bytes,
      digest: await digestHex(bytes),
    });
  }
  return files;
}

export async function storeEvidence(
  context: FeedbackContext,
  input: {
    submissionId: string;
    organizationId: string;
    files: ValidatedEvidence[];
    createdAt: string;
  },
): Promise<StoredEvidence[]> {
  if (input.files.length === 0) return [];
  const bucket = context.env.PRIVATE_ASSETS;
  if (!bucket) throw new EvidenceStorageUnavailableError();

  const stored: StoredEvidence[] = [];
  try {
    for (const [index, file] of input.files.entries()) {
      const assetId = await stableId(
        "asset",
        `${input.submissionId}:${index}:${file.digest}`,
      );
      const scope: PrivateAssetScope = {
        purpose: "feedback_attachment",
        organizationId: input.organizationId,
        ownerSubject: guestOwner(input.submissionId),
        recordId: input.submissionId,
      };
      const objectKey = privateAssetKey(scope, assetId);
      const row: PrivateAssetRow = {
        id: assetId,
        organization_id: input.organizationId,
        owner_subject: scope.ownerSubject,
        purpose: "feedback_attachment",
        record_id: input.submissionId,
        object_key: objectKey,
        filename: file.fileName,
        content_type: file.contentType,
        byte_size: file.data.byteLength,
        created_at: input.createdAt,
      };
      await bucket.put(objectKey, file.data, {
        httpMetadata: { contentType: file.contentType },
      });
      stored.push({
        row,
        scope,
        metadata: {
          id: assetId,
          fileName: file.fileName,
          contentType: file.contentType,
          byteSize: file.data.byteLength,
        },
      });
    }
  } catch (error) {
    await deleteStoredEvidence(bucket, stored);
    throw error;
  }
  return stored;
}

export function evidenceInsertStatements(
  database: D1Database,
  evidence: StoredEvidence[],
): D1PreparedStatement[] {
  return evidence.map(({ row }) =>
    database
      .prepare(
        `INSERT OR IGNORE INTO private_assets (
          id, organization_id, owner_subject, purpose, record_id, object_key,
          filename, content_type, byte_size, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.organization_id,
        row.owner_subject,
        row.purpose,
        row.record_id,
        row.object_key,
        row.filename,
        row.content_type,
        row.byte_size,
        row.created_at,
      ),
  );
}

export async function deleteStoredEvidence(
  bucket: R2Bucket,
  evidence: StoredEvidence[],
): Promise<void> {
  await Promise.all(
    evidence.map(async ({ row }) => {
      try {
        await bucket.delete(row.object_key);
      } catch {
        // Cleanup failure must not disclose a storage key or file contents.
      }
    }),
  );
}

export async function listEvidence(
  database: D1Database,
  submissionId: string,
): Promise<PrivateAssetRow[]> {
  const result = await database
    .prepare(
      `SELECT id, organization_id, owner_subject, purpose, record_id,
        object_key, filename, content_type, byte_size, created_at
       FROM private_assets
       WHERE purpose = 'feedback_attachment' AND record_id = ?
       ORDER BY created_at, id`,
    )
    .bind(submissionId)
    .all<PrivateAssetRow>();
  return result.results ?? [];
}

export function evidenceView(row: PrivateAssetRow): EvidenceMetadata {
  return {
    id: row.id,
    fileName: row.filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
  };
}

export async function downloadEvidence(
  context: FeedbackContext,
  input: {
    submissionId: string;
    assetId: string;
    organizationId: string;
    tokenHash?: string;
  },
): Promise<Response | null> {
  const database = context.env.DB;
  const row = await database
    .prepare(
      `SELECT id, organization_id, owner_subject, purpose, record_id,
        object_key, filename, content_type, byte_size, created_at
       FROM private_assets
       WHERE id = ? AND record_id = ? AND purpose = 'feedback_attachment'
         AND organization_id = ?`,
    )
    .bind(input.assetId, input.submissionId, input.organizationId)
    .first<PrivateAssetRow>();
  if (!row) return null;

  if (input.tokenHash) {
    const submission = await database
      .prepare(
        `SELECT id FROM feedback_submissions
         WHERE id = ? AND organization_id = ? AND receipt_token_hash = ?`,
      )
      .bind(input.submissionId, input.organizationId, input.tokenHash)
      .first<{ id: string }>();
    if (!submission) return null;
  }

  const bucket = context.env.PRIVATE_ASSETS;
  if (!bucket) throw new EvidenceStorageUnavailableError();
  const scope: PrivateAssetScope = {
    purpose: row.purpose,
    organizationId: row.organization_id,
    ownerSubject: row.owner_subject,
    recordId: row.record_id,
  };
  const metadata: PrivateAssetMetadata = {
    purpose: row.purpose,
    organizationId: row.organization_id,
    ownerSubject: row.owner_subject,
    recordId: row.record_id,
    assetId: row.id,
    objectKey: row.object_key,
  };
  if (!canReadPrivateAsset(scope, metadata)) return null;
  const object = await readPrivateAsset(bucket, scope, metadata);
  if (!object) return null;

  const headers = new Headers(context.cors);
  headers.set("Content-Type", row.content_type);
  headers.set("Content-Length", String(row.byte_size));
  headers.set("Content-Disposition", disposition(row.filename));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "private, no-store");
  return new Response(object.body, { status: 200, headers });
}

export function guestOwner(submissionId: string): string {
  return `guest:${submissionId}`;
}

function isEvidenceInput(value: unknown): value is EvidenceInput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EvidenceInput>;
  return (
    typeof candidate.fileName === "string" &&
    typeof candidate.contentType === "string" &&
    ["application/pdf", "image/jpeg", "image/png"].includes(
      candidate.contentType,
    ) &&
    typeof candidate.data === "string"
  );
}

function decodeBase64(value: string): Uint8Array {
  if (
    value.length > Math.ceil(MAX_EVIDENCE_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new InvalidEvidenceError();
  }
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    throw new InvalidEvidenceError();
  }
}

function matchesContentType(
  contentType: EvidenceInput["contentType"],
  bytes: Uint8Array,
): boolean {
  if (contentType === "application/pdf")
    return bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-";
  if (contentType === "image/png")
    return (
      bytes.length >= 8 &&
      bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
    );
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return Array.from(bytes.slice(start, end), (byte) =>
    String.fromCharCode(byte),
  ).join("");
}

function safeFileName(value: string): string | null {
  const baseName = value.replaceAll("\\", "/").split("/").pop() ?? "";
  const clean = baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean.length > 0 ? clean.slice(0, 120) : null;
}

function disposition(fileName: string): string {
  return `attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
