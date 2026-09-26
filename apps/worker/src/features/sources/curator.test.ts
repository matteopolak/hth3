import { describe, expect, it } from "vitest";
import type {
  D1Database,
  D1PreparedStatement,
  R2Bucket,
} from "@civicresolve/db/d1";
import type { FeatureContext } from "../shared.js";
import { handleSourceCuratorRequest } from "./curator.js";

function fixture() {
  const executed: string[] = [];
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
            return {
              results: [
                {
                  organization_id: "org_staff",
                  role: values.at(-1),
                },
              ],
            };
          }
          if (query.includes("LEFT JOIN source_records")) {
            return {
              results: [
                {
                  id: "official-one",
                  origin: "official_external",
                  name: "Official source",
                  publisher: "Government of Canada",
                  source_url: "https://canada.ca/example",
                  jurisdiction_level: "federal",
                  jurisdiction_code: "CA",
                  jurisdiction_name: "Canada",
                  municipality_code: null,
                  municipality_name: null,
                  licence_name: null,
                  licence_url: null,
                  terms_url: "https://canada.ca/terms",
                  terms_status: "permitted",
                  collection_mode: "manual",
                  fetched_at: null,
                  verified_at: null,
                  expires_at: null,
                  freshness_state: "unknown",
                  last_error: null,
                  sample_label: null,
                  version: 1,
                  record_count: 0,
                },
              ],
            };
          }
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          executed.push(query);
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement as unknown as D1PreparedStatement;
    },
    async batch(statements: D1PreparedStatement[]) {
      for (const statement of statements) {
        void statement;
      }
      return [];
    },
  };
  const context: FeatureContext = {
    env: {
      DB: database as unknown as D1Database,
      PRIVATE_ASSETS: {} as R2Bucket,
      APP_ENV: "development",
      DEV_AUTH_ENABLED: "true",
    },
    requestId: "source-curator-test",
    cors: new Headers(),
  };
  return { context, executed };
}

async function request(
  token: string | undefined,
  path = "/api/v1/staff/sources",
  method = "GET",
  body?: unknown,
) {
  const { context } = fixture();
  const url = new URL(path, "https://example.test");
  const response = await handleSourceCuratorRequest(
    new Request(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    url,
    context,
  );
  return response!;
}

describe("source curator API", () => {
  it("requires a platform curator for global source review", async () => {
    expect((await request(undefined)).status).toBe(401);
    expect((await request("dev-civic-staff")).status).toBe(403);
    expect((await request("dev-curator")).status).toBe(200);
  });

  it("rejects status overrides and non-HTTPS evidence", async () => {
    const statusOverride = await request(
      "dev-curator",
      "/api/v1/staff/sources/official-one/changes",
      "POST",
      {
        expectedVersion: 1,
        reason: "Please make this appear current.",
        evidenceUrl: "https://canada.ca/evidence",
        changes: { freshnessState: "current" },
      },
    );
    expect(statusOverride.status).toBe(400);

    const insecureEvidence = await request(
      "dev-curator",
      "/api/v1/staff/sources/official-one/changes",
      "POST",
      {
        expectedVersion: 1,
        reason: "Source metadata was reviewed.",
        evidenceUrl: "http://canada.ca/evidence",
        changes: { publisher: "Government of Canada" },
      },
    );
    expect(insecureEvidence.status).toBe(400);
  });
});
