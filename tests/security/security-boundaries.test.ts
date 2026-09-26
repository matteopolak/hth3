import { beforeEach, describe, expect, it, vi } from "vitest";
import { permissionsForRoles } from "../../packages/domain/src/permissions/index.js";
import {
  privateAssetKey,
  readPrivateAsset,
  type R2Bucket,
} from "../../packages/db/src/d1/index.js";
import {
  toSourceRecord,
  type SourceRecordRow,
} from "../../packages/sources/src/index.js";
import {
  toConsultation,
  type ConsultationRow,
} from "../../packages/sources/src/adapters/consultations/index.js";
import type { AuthenticatedActor } from "../../apps/worker/src/auth/identity.js";
import { handleEmployerRequest } from "../../apps/worker/src/features/employer/index.js";
import { handleFeedbackRequest } from "../../apps/worker/src/features/feedback-core/index.js";
import { handleProfileRequest } from "../../apps/worker/src/features/profile/index.js";
import type { FeatureContext } from "../../apps/worker/src/features/shared.js";

const auth = vi.hoisted(() => ({ actor: null as unknown }));
vi.mock("../../apps/worker/src/auth/identity.js", () => ({
  authenticateRequest: async () => auth.actor,
}));

const dbRead = vi.fn(() => {
  throw new Error("Denied request reached D1");
});
const r2Read = vi.fn(() => {
  throw new Error("Denied request reached R2");
});
const context = {
  env: { DB: { prepare: dbRead }, PRIVATE_ASSETS: { get: r2Read } },
  requestId: "security-audit",
  cors: new Headers(),
} as unknown as FeatureContext;

function actor(
  role: "applicant" | "civic_staff" | "organization_admin",
  organizationId: string | null,
): AuthenticatedActor {
  return {
    subject: `audit:${role}`,
    roles: [role],
    organizationId,
    permissions: permissionsForRoles([role]),
    authMethod: "auth0",
  };
}

beforeEach(() => {
  auth.actor = null;
  dbRead.mockClear();
  r2Read.mockClear();
});

describe("server-side privacy boundaries", () => {
  it("denies cross-organization staff reads and writes before database access", async () => {
    auth.actor = actor("organization_admin", "org_a");
    const postingUrl = new URL(
      "https://envoy.test/api/v1/staff/organizations/org_b/postings",
    );
    const posting = await handleEmployerRequest(
      new Request(postingUrl),
      postingUrl,
      context,
    );
    expect(posting?.status).toBe(403);

    auth.actor = actor("civic_staff", "org_a");
    const feedbackUrl = new URL(
      "https://envoy.test/api/v1/staff/organizations/org_b/feedback",
    );
    const feedback = await handleFeedbackRequest(
      new Request(feedbackUrl),
      feedbackUrl,
      context,
    );
    expect(feedback?.status).toBe(403);

    auth.actor = actor("applicant", "org_a");
    const sameOrg = await handleEmployerRequest(
      new Request(postingUrl.href.replace("org_b", "org_a")),
      new URL(postingUrl.href.replace("org_b", "org_a")),
      context,
    );
    expect(sameOrg?.status).toBe(403);
    expect(dbRead).not.toHaveBeenCalled();
  });

  it("denies guest profile reads and cross-tenant shared résumé downloads before R2", async () => {
    const profileUrl = new URL("https://envoy.test/api/v1/profile");
    const profile = await handleProfileRequest(
      new Request(profileUrl),
      profileUrl,
      context,
    );
    expect(profile?.status).toBe(401);

    auth.actor = actor("organization_admin", "org_a");
    const sharedUrl = new URL(
      "https://envoy.test/api/v1/staff/organizations/org_b/applications/app_1/resume",
    );
    const shared = await handleProfileRequest(
      new Request(sharedUrl),
      sharedUrl,
      context,
    );
    expect(shared?.status).toBe(403);
    expect(dbRead).not.toHaveBeenCalled();
    expect(r2Read).not.toHaveBeenCalled();
  });

  it("blocks a private asset with a mismatched owner or organization before R2", async () => {
    const scope = {
      purpose: "feedback_attachment" as const,
      organizationId: "org_a",
      ownerSubject: "resident_a",
      recordId: "fb_1",
    };
    const asset = {
      ...scope,
      assetId: "asset_1",
      objectKey: privateAssetKey(scope, "asset_1"),
    };
    const bucket = { get: r2Read } as unknown as R2Bucket;
    await expect(
      readPrivateAsset(bucket, { ...scope, ownerSubject: "resident_b" }, asset),
    ).rejects.toThrow("outside the authorized scope");
    await expect(
      readPrivateAsset(bucket, { ...scope, organizationId: "org_b" }, asset),
    ).rejects.toThrow("outside the authorized scope");
    expect(r2Read).not.toHaveBeenCalled();
  });

  it("preserves source attribution while withholding verification from stale, restricted and sample records", () => {
    const row: SourceRecordRow = {
      id: "source-1",
      source_id: "registry-1",
      origin: "official_external",
      external_id: "external-1",
      title: "Service",
      summary: "Official service",
      source_url: "https://publisher.example/service",
      publisher: "Official publisher",
      jurisdiction_level: "provincial",
      jurisdiction_code: "CA-ON",
      jurisdiction_name: "Ontario",
      municipality_code: null,
      municipality_name: null,
      licence_name: "Open licence",
      licence_url: "https://publisher.example/licence",
      terms_url: "https://publisher.example/terms",
      terms_status: "permitted",
      language: "en",
      fetched_at: "2026-09-01T00:00:00Z",
      verified_at: "2026-09-01T00:00:00Z",
      expires_at: null,
      payload_hash: "hash",
      evidence_url: "https://publisher.example/service",
      freshness_state: "current",
      last_error_code: null,
      sample_label: null,
    };
    const now = new Date("2026-09-26T00:00:00Z");
    const current = toSourceRecord(row, now);
    expect(current).toMatchObject({
      verified: true,
      publisher: "Official publisher",
      licence: {
        name: "Open licence",
        url: "https://publisher.example/licence",
      },
      termsStatus: "permitted",
      sampleLabel: null,
    });
    expect(
      toSourceRecord({ ...row, freshness_state: "stale" }, now),
    ).toMatchObject({ freshness: "stale", verified: false });
    expect(
      toSourceRecord({ ...row, terms_status: "restricted" }, now).verified,
    ).toBe(false);
    expect(
      toSourceRecord(
        { ...row, origin: "sample", sample_label: "Practice record" },
        now,
      ),
    ).toMatchObject({ verified: false, sampleLabel: "Practice record" });
  });

  it("does not present a publisher outage as an open consultation", () => {
    const row: ConsultationRow = {
      id: "consultation-1",
      kind: "consultation",
      title: "Public consultation",
      summary: "Official opportunity",
      publisher: "Official publisher",
      jurisdiction_level: "provincial",
      jurisdiction_code: "CA-ON",
      jurisdiction_name: "Ontario",
      official_url: "https://publisher.example/consultation",
      evidence_url: "https://publisher.example/consultation",
      deadline_date: "2026-10-31",
      verified_at: "2026-09-01T00:00:00Z",
      expires_at: "2026-10-01T00:00:00Z",
      source_state: "error",
      last_error: "Publisher unavailable",
    };
    expect(toConsultation(row, new Date("2026-09-26T00:00:00Z"))).toMatchObject(
      {
        sourceState: "error",
        participationStatus: "check_official_source",
        externalOnly: true,
        inAppSubmission: false,
      },
    );
  });
});
