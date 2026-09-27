import { describe, expect, it } from "vitest";
import {
  getSourceRecord,
  listSourceRecords,
} from "../src/d1/source-records.js";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "../src/d1/types.js";
import type { SourceRecordRow } from "@civicresolve/sources";
import { toSourceRecord } from "@civicresolve/sources";

const sampleRecord: SourceRecordRow = {
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

const officialRecord: SourceRecordRow = {
  ...sampleRecord,
  id: "record-official-permitted",
  source_id: "source-official",
  origin: "official_external",
  external_id: "external-42",
  title: "Official record",
  summary: "A record fixture used only in an isolated test.",
  source_url: "https://example.gov/record",
  publisher: "Example government",
  jurisdiction_level: "federal",
  jurisdiction_code: "CA",
  jurisdiction_name: "Canada",
  municipality_code: null,
  municipality_name: null,
  terms_status: "permitted",
  language: "fr",
  fetched_at: "2026-09-20T00:00:00.000Z",
  verified_at: "2026-09-20T00:00:00.000Z",
  freshness_state: "current",
  sample_label: null,
};

const unreviewedRecord: SourceRecordRow = {
  ...officialRecord,
  id: "record-unreviewed",
  terms_status: "unreviewed",
};

function databaseWithRows(
  rows: SourceRecordRow[],
  sourceTerms: Record<string, string> = {},
) {
  let query = "";
  let bound: unknown[] = [];
  const visibleRows = () =>
    rows.filter((row) =>
      row.origin === "sample"
        ? bound.at(-1) === 1
        : row.terms_status === "permitted" &&
          (sourceTerms[row.source_id] ?? "permitted") === "permitted",
    );
  const statement = {
    bind(...values: unknown[]) {
      bound = values;
      return statement;
    },
    async first<Row>() {
      const id = bound[0];
      return (visibleRows().find((row) => row.id === id) ?? null) as Row | null;
    },
    async all<Row>() {
      return {
        success: true,
        results: visibleRows() as Row[],
        meta: {
          changes: 0,
          duration: 0,
          last_row_id: 0,
          rows_read: 0,
          rows_written: 0,
        },
      } satisfies D1Result<Row>;
    },
    async run<Row>() {
      return {
        success: true,
        results: [],
        meta: {
          changes: 0,
          duration: 0,
          last_row_id: 0,
          rows_read: 0,
          rows_written: 0,
        },
      } satisfies D1Result<Row>;
    },
  } satisfies D1PreparedStatement;
  const database = {
    prepare(sql: string) {
      query = sql;
      bound = [];
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

describe("public source record reads", () => {
  const rows = [sampleRecord, officialRecord, unreviewedRecord];

  it("hides samples by default and includes only permitted external records", async () => {
    const result = databaseWithRows(rows);
    const records = await listSourceRecords(result.database);
    expect(result.query).toContain("terms_status = 'permitted'");
    expect(records.map((record) => record.id)).toEqual([officialRecord.id]);
    expect(records[0]?.verified).toBe(true);
  });

  it("hides a record when its source registry terms are restricted", async () => {
    const result = databaseWithRows([officialRecord], {
      [officialRecord.source_id]: "restricted",
    });
    expect(await listSourceRecords(result.database)).toEqual([]);
    expect(result.query).toContain("source_registry.terms_status = 'permitted'");
    expect(await getSourceRecord(result.database, officialRecord.id)).toBeNull();
  });

  it("includes opt-in samples with explicit provenance and false verification", async () => {
    const result = databaseWithRows(rows);
    const records = await listSourceRecords(result.database, {
      includeSamples: true,
    });
    expect(result.query).toContain("origin = 'sample'");
    const sample = records.find((record) => record.origin === "sample");
    expect(sample).toMatchObject({
      sampleLabel: "Fictional sample only",
      verified: false,
      freshness: "unknown",
      jurisdiction: { municipality: { code: "CA-ON-TOR", name: "Toronto" } },
    });
  });

  it("hides sample detail unless explicitly requested", async () => {
    const { database } = databaseWithRows(rows);
    await expect(
      getSourceRecord(database, sampleRecord.id),
    ).resolves.toBeNull();
    await expect(
      getSourceRecord(database, sampleRecord.id, { includeSamples: true }),
    ).resolves.toMatchObject({
      id: sampleRecord.id,
      origin: "sample",
      verified: false,
    });
  });

  it("does not mark current-looking content verified while terms are unreviewed", async () => {
    const unreviewedCurrent = {
      ...officialRecord,
      terms_status: "unreviewed" as const,
      freshness_state: "current" as const,
    };
    const { database } = databaseWithRows([unreviewedCurrent]);
    expect(toSourceRecord(unreviewedCurrent).verified).toBe(false);
    const hiddenFromPublic = await listSourceRecords(database, {
      includeSamples: true,
    });
    expect(hiddenFromPublic).toHaveLength(0);
  });

  it("does not accept future verification timestamps as current evidence", () => {
    const futureRecord = {
      ...officialRecord,
      fetched_at: "2099-01-01T00:00:00.000Z",
      verified_at: "2099-01-01T00:00:00.000Z",
      expires_at: "2099-01-02T00:00:00.000Z",
    };
    expect(
      toSourceRecord(futureRecord, new Date("2026-09-26T00:00:00.000Z")),
    ).toMatchObject({ freshness: "unknown", verified: false });
  });
});
