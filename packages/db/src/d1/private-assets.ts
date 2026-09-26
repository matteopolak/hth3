import type { R2Bucket, R2ObjectBody } from "./types.js";

export type PrivateAssetPurpose =
  | "resume"
  | "application_attachment"
  | "feedback_attachment";

export interface PrivateAssetScope {
  purpose: PrivateAssetPurpose;
  organizationId: string | null;
  ownerSubject: string;
  recordId: string;
}

export interface PrivateAssetMetadata extends PrivateAssetScope {
  assetId: string;
  objectKey: string;
}

export function privateAssetKey(
  scope: PrivateAssetScope,
  assetId: string,
): string {
  const organization = scope.organizationId
    ? segment(scope.organizationId)
    : "guest";
  return [
    "private",
    scope.purpose,
    organization,
    segment(scope.ownerSubject),
    segment(scope.recordId),
    segment(assetId),
  ].join("/");
}

export function canReadPrivateAsset(
  grant: PrivateAssetScope,
  asset: PrivateAssetMetadata,
): boolean {
  return (
    grant.purpose === asset.purpose &&
    grant.organizationId === asset.organizationId &&
    grant.ownerSubject === asset.ownerSubject &&
    grant.recordId === asset.recordId &&
    asset.objectKey === privateAssetKey(asset, asset.assetId)
  );
}

export async function readPrivateAsset(
  bucket: R2Bucket,
  grant: PrivateAssetScope,
  asset: PrivateAssetMetadata,
): Promise<R2ObjectBody | null> {
  if (!canReadPrivateAsset(grant, asset)) throw new PrivateAssetAccessError();
  return bucket.get(asset.objectKey);
}

export class PrivateAssetAccessError extends Error {
  constructor() {
    super("The requested file is outside the authorized scope.");
    this.name = "PrivateAssetAccessError";
  }
}

function segment(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "." || trimmed === "..") {
    throw new TypeError(
      "Private asset path segments must be non-empty identifiers.",
    );
  }
  return encodeURIComponent(trimmed);
}
