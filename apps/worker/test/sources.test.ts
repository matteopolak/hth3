import { describe, expect, it } from "vitest";
import { handleSourceRequest } from "../src/features/sources/index.js";
import type { FeatureContext } from "../src/features/shared.js";
import type { D1Database, D1PreparedStatement } from "@civicresolve/db/d1";

const sampleRow = {
  id: "fictional-toronto-sample",
  origin: "sample",
  name: "Fictional Toronto demonstration source",
  publisher:
    "CivicResolve demo (fictional; unaffiliated with the City of Toronto)",
  source_url: "sample://fictional/toronto-demo",
  jurisdiction_level: "municipal",
  jurisdiction_code: "CA-ON-TOR",
  jurisdiction_name: "Toronto, Ontario",
  municipality_code: "CA-ON-TOR",
  municipality_name: "Toronto",
  licence_name: null,
  licence_url: null,
  terms_url: null,
  terms_status: "unreviewed",
  collection_mode: "sample",
  fetched_at: null,
  verified_at: null,
  expires_at: null,
  freshness_state: "unknown",
  last_error: null,
  sample_label: "Fictional sample only",
};

function context(): FeatureContext {
  const statement = {
    bind: () => statement,
    first: async () => null,
    run: async () => ({ success: true, results: [], meta: {} }),
    all: async () => ({
      success: true,
      results: [sampleRow],
      meta: {
        changes: 0,
        duration: 0,
        last_row_id: 0,
        rows_read: 1,
        rows_written: 0,
      },
    }),
  } as unknown as D1PreparedStatement;
  const database = {
    prepare: () => statement,
    batch: async () => [],
  } as unknown as D1Database;
  return {
    env: { DB: database, APP_ENV: "development" },
    requestId: "request-source-test",
    cors: new Headers(),
  };
}

describe("source registry route", () => {
  it("returns null for paths owned by other features", async () => {
    const result = await handleSourceRequest(
      new Request("https://example.test/api/v1/other"),
      new URL("https://example.test/api/v1/other"),
      context(),
    );
    expect(result).toBeNull();
  });

  it("exposes sample geography and label only with explicit opt-in", async () => {
    const ctx = context();
    const response = await handleSourceRequest(
      new Request("https://example.test/api/v1/sources?includeSamples=true"),
      new URL("https://example.test/api/v1/sources?includeSamples=true"),
      ctx,
    );
    expect(response?.status).toBe(200);
    const body = (await response?.json()) as {
      samplesIncluded: boolean;
      sources: Array<{
        origin: string;
        sampleLabel: string | null;
        jurisdiction: { municipality: { name: string } | null };
      }>;
    };
    expect(body.samplesIncluded).toBe(true);
    expect(body.sources[0]).toMatchObject({
      origin: "sample",
      sampleLabel: "Fictional sample only",
      jurisdiction: { municipality: { name: "Toronto" } },
    });
  });

  it("rejects writes to the read-only registry route", async () => {
    const response = await handleSourceRequest(
      new Request("https://example.test/api/v1/sources", { method: "POST" }),
      new URL("https://example.test/api/v1/sources"),
      context(),
    );
    expect(response?.status).toBe(405);
    expect(await response?.json()).toMatchObject({
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });
});
