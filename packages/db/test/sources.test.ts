import { describe, expect, it } from "vitest";
import { listSourceRegistry } from "../src/d1/sources.js";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "../src/d1/types.js";
import type { SourceRegistryRow } from "@civicresolve/sources";

const baseRow: SourceRegistryRow = {
  id: "gc-jobs",
  origin: "official_external",
  name: "Government of Canada jobs",
  publisher: "Government of Canada",
  source_url:
    "https://www.canada.ca/en/services/jobs/opportunities/government.html",
  jurisdiction_level: "federal",
  jurisdiction_code: "CA",
  jurisdiction_name: "Canada",
  municipality_code: null,
  municipality_name: null,
  licence_name: null,
  licence_url: null,
  terms_url: null,
  terms_status: "unreviewed",
  collection_mode: "official_link",
  fetched_at: null,
  verified_at: null,
  expires_at: null,
  freshness_state: "unknown",
  last_error: null,
  sample_label: null,
};

function databaseWithRows(rows: SourceRegistryRow[]) {
  let query = "";
  const statement = {
    bind: () => statement,
    first: async () => null,
    run: async () => ({ success: true, results: [], meta: {} }) as D1Result,
    all: async <Row>() =>
      ({
        success: true,
        results: rows as Row[],
        meta: {
          changes: 0,
          duration: 0,
          last_row_id: 0,
          rows_read: 0,
          rows_written: 0,
        },
      }) as D1Result<Row>,
  } satisfies D1PreparedStatement;
  const database = {
    prepare(sql: string) {
      query = sql;
      return statement;
    },
    batch: async () => [],
  } satisfies D1Database;
  return {
    database,
    get query() {
      return query;
    },
  };
}

describe("source registry reads", () => {
  it("excludes fictional samples unless the caller explicitly requests them", async () => {
    const sample: SourceRegistryRow = {
      ...baseRow,
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
      collection_mode: "sample",
      sample_label: "Fictional sample only",
    };
    const defaultDb = databaseWithRows([baseRow]);
    const defaults = await listSourceRegistry(defaultDb.database);
    expect(defaultDb.query).toContain("origin <> 'sample'");
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.sampleLabel).toBeNull();

    const sampleDb = databaseWithRows([sample]);
    const samples = await listSourceRegistry(sampleDb.database, {
      includeSamples: true,
    });
    expect(sampleDb.query).not.toContain("origin <> 'sample'");
    expect(samples[0]?.sampleLabel).toBe("Fictional sample only");
    expect(samples[0]?.jurisdiction.municipality?.name).toBe("Toronto");
  });

  it("reports records expired by time as expired even when stored state is current", async () => {
    const expiredRow: SourceRegistryRow = {
      ...baseRow,
      verified_at: "2020-01-01T00:00:00.000Z",
      expires_at: "2020-01-02T00:00:00.000Z",
      freshness_state: "current",
    };
    const { database } = databaseWithRows([expiredRow]);
    const [source] = await listSourceRegistry(database);
    expect(source?.freshness).toBe("expired");
  });
});
