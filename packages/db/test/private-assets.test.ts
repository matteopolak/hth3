import { describe, expect, it } from "vitest";
import {
  canReadPrivateAsset,
  privateAssetKey,
  PrivateAssetAccessError,
  readPrivateAsset,
  type PrivateAssetMetadata,
  type PrivateAssetScope,
} from "../src/d1/private-assets.js";
import type { R2Bucket } from "../src/d1/types.js";

describe("private R2 asset scopes", () => {
  const scope: PrivateAssetScope = {
    purpose: "application_attachment",
    organizationId: "org_sandbox",
    ownerSubject: "auth0|applicant-1",
    recordId: "application-123",
  };
  const asset: PrivateAssetMetadata = {
    ...scope,
    assetId: "asset-1",
    objectKey: privateAssetKey(scope, "asset-1"),
  };

  it("allows the exact record, organization, owner, and purpose scope", () => {
    expect(canReadPrivateAsset(scope, asset)).toBe(true);
    expect(asset.objectKey).toContain(
      "private/application_attachment/org_sandbox/",
    );
  });

  it("rejects a different tenant or owner before it reads from R2", async () => {
    const get = async () => null;
    const bucket = { get } as unknown as R2Bucket;

    await expect(
      readPrivateAsset(
        bucket,
        { ...scope, organizationId: "org_other" },
        asset,
      ),
    ).rejects.toBeInstanceOf(PrivateAssetAccessError);
    await expect(
      readPrivateAsset(
        bucket,
        { ...scope, ownerSubject: "auth0|other" },
        asset,
      ),
    ).rejects.toBeInstanceOf(PrivateAssetAccessError);
  });
});
