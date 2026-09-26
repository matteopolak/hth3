import { describe, expect, it } from "vitest";
import type { D1Database, R2Bucket } from "@civicresolve/db/d1";
import type { FeatureContext } from "../shared.js";
import { handleStaffWorkspaceRequest } from "./index.js";

const organizationId = "org_local_test";
const path = `/api/v1/staff/organizations/${organizationId}/workspace`;

function context(): FeatureContext {
  const database = {
    prepare(query: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) {
          values = next;
          return statement;
        },
        async all() {
          if (query.includes("organization_memberships")) {
            const role = String(values.at(-1));
            const memberOrganizationId =
              values[0] === "local:other-civic-staff"
                ? "org_local_other"
                : organizationId;
            return {
              results: [{ organization_id: memberOrganizationId, role }],
            };
          }
          if (query.includes("audit_events")) {
            return {
              results: [
                {
                  id: "event-1",
                  action: "posting.created",
                  entity_type: "posting",
                  entity_id: "posting-1",
                  created_at: "2026-09-26T00:00:00Z",
                },
              ],
            };
          }
          return { results: [] };
        },
        async first() {
          return null;
        },
      };
      return statement;
    },
  };
  return {
    env: {
      DB: database as unknown as D1Database,
      PRIVATE_ASSETS: {} as R2Bucket,
      APP_ENV: "development",
      DEV_AUTH_ENABLED: "true",
    },
    requestId: "workspace-test",
    cors: new Headers(),
  };
}

async function get(token?: string, target = path) {
  const url = new URL(target, "https://example.test");
  const request = new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return (await handleStaffWorkspaceRequest(request, url, context()))!;
}

describe("staff workspace permissions", () => {
  it("rejects guests, another organization, and an applicant", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("dev-other-civic-staff")).status).toBe(403);
    expect((await get("dev-applicant")).status).toBe(403);
  });

  it("limits capabilities and audit to the member role", async () => {
    const civic = await get("dev-civic-staff");
    expect(civic.status).toBe(200);
    expect(await civic.json()).toMatchObject({
      capabilities: {
        feedbackRead: true,
        applicantReview: false,
        postingManage: false,
        taxonomyManage: false,
        sourceManage: false,
        auditRead: false,
      },
      auditEvents: [],
    });

    const admin = await get("dev-organization-admin");
    expect(admin.status).toBe(200);
    expect(await admin.json()).toMatchObject({
      capabilities: {
        applicantReview: true,
        postingManage: true,
        taxonomyManage: true,
        sourceManage: false,
        auditRead: true,
      },
      auditEvents: [
        { id: "event-1", entityType: "posting", entityId: "posting-1" },
      ],
    });

    const curator = await get("dev-curator");
    expect(curator.status).toBe(200);
    expect(await curator.json()).toMatchObject({
      capabilities: {
        feedbackRead: false,
        postingManage: false,
        taxonomyManage: true,
        sourceManage: true,
        auditRead: true,
      },
    });
  });
});
