import { describe, expect, it } from "vitest";
import { handleSourceRequest } from "../src/features/sources/index.js";
import type { FeatureContext } from "../src/features/shared.js";
import type { D1Database, D1PreparedStatement } from "@civicresolve/db/d1";

const sampleSourceRow = {
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

const sampleRecordRow = {
  id: "sample-toronto-community-resource",
  source_id: "fictional-toronto-sample",
  origin: "sample",
  external_id: null,
  title: "Sample: Neighbourhood resource information session",
  summary:
    "Fictional demonstration record. This is not an actual event or City of Toronto service.",
  source_url: "sample://fictional/toronto-demo",
  publisher:
    "CivicResolve demo (fictional; unaffiliated with the City of Toronto)",
  jurisdiction_level: "municipal",
  jurisdiction_code: "CA-ON-TOR",
  jurisdiction_name: "Toronto, Ontario",
  municipality_code: "CA-ON-TOR",
  municipality_name: "Toronto",
  licence_name: null,
  licence_url: null,
  terms_url: null,
  terms_status: "unreviewed",
  language: "en",
  fetched_at: null,
  verified_at: null,
  expires_at: null,
  payload_hash: null,
  evidence_url: null,
  freshness_state: "unknown",
  last_error_code: null,
  sample_label: "Fictional sample only",
};

function context(): FeatureContext {
  let query = "";
  let bindings: unknown[] = [];
  const statement = {
    bind: (...values: unknown[]) => {
      bindings = values;
      return statement;
    },
    first: async () =>
      query.includes("FROM source_records") &&
      bindings[0] === sampleRecordRow.id &&
      bindings.at(-1) === 1
        ? sampleRecordRow
        : null,
    run: async () => ({ success: true, results: [], meta: {} }),
    all: async () => ({
      success: true,
      results: query.includes("FROM source_registry")
        ? [sampleSourceRow]
        : query.includes("FROM source_records") && bindings.at(-1) === 1
          ? [sampleRecordRow]
          : [],
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
    prepare: (sql: string) => {
      query = sql;
      bindings = [];
      return statement;
    },
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

  it("exposes sample source geography and label only with explicit opt-in", async () => {
    const url = new URL(
      "https://example.test/api/v1/sources?includeSamples=true",
    );
    const response = await handleSourceRequest(
      new Request(url),
      url,
      context(),
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
    const url = new URL("https://example.test/api/v1/sources");
    const response = await handleSourceRequest(
      new Request(url, { method: "POST" }),
      url,
      context(),
    );
    expect(response?.status).toBe(405);
    expect(await response?.json()).toMatchObject({
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });

  it("returns record details only when sample access is opted in", async () => {
    const hiddenUrl = new URL(
      "https://example.test/api/v1/source-records/sample-toronto-community-resource",
    );
    const hidden = await handleSourceRequest(
      new Request(hiddenUrl),
      hiddenUrl,
      context(),
    );
    expect(hidden?.status).toBe(404);

    const visibleUrl = new URL(
      "https://example.test/api/v1/source-records/sample-toronto-community-resource?includeSamples=true",
    );
    const visible = await handleSourceRequest(
      new Request(visibleUrl),
      visibleUrl,
      context(),
    );
    expect(visible?.status).toBe(200);
    expect(await visible?.json()).toMatchObject({
      record: {
        origin: "sample",
        sampleLabel: "Fictional sample only",
        verified: false,
        jurisdiction: { municipality: { name: "Toronto" } },
      },
    });
  });
});
