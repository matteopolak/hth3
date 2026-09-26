import { describe, expect, it, vi } from "vitest";
import {
  canResidentReopenFeedback,
  canTransitionFeedback,
  isFeedbackCategory,
  preserveFeedbackText,
} from "@civicresolve/domain/feedback";
import type {
  D1Database,
  D1PreparedStatement,
  R2Bucket,
} from "@civicresolve/db/d1";
import { handleFeedbackRequest } from "./index.js";
import { enforceGuestAbuseLimit } from "./abuse.js";
import {
  downloadEvidence,
  InvalidEvidenceError,
  validateEvidence,
} from "./evidence.js";
import type { FeedbackContext, FeedbackRow } from "./types.js";
import { sha256Hex } from "../shared.js";

describe("feedback domain rules", () => {
  it("preserves original wording while rejecting blank or oversized text", () => {
    const original = "  The crossing light is too short.  ";
    expect(preserveFeedbackText(original, 80)).toBe(original);
    expect(preserveFeedbackText("  \n", 80)).toBeNull();
    expect(preserveFeedbackText("x".repeat(81), 80)).toBeNull();
  });

  it("only permits documented staff transitions and resident reopen states", () => {
    expect(canTransitionFeedback("submitted", "acknowledged")).toBe(true);
    expect(canTransitionFeedback("submitted", "closed")).toBe(false);
    expect(canTransitionFeedback("closed", "reopened")).toBe(true);
    expect(canResidentReopenFeedback("outcome_recorded")).toBe(true);
    expect(canResidentReopenFeedback("closed")).toBe(true);
    expect(canResidentReopenFeedback("in_review")).toBe(false);
  });

  it("accepts only the routed feedback categories", () => {
    expect(isFeedbackCategory("other_or_unsure")).toBe(true);
    expect(isFeedbackCategory("made_up_department")).toBe(false);
  });
});

describe("private evidence validation", () => {
  it("accepts a correctly typed PDF and strips path components from its name", async () => {
    const [file] = await validateEvidence([
      {
        fileName: "../crossing.pdf",
        contentType: "application/pdf",
        data: btoa("%PDF-1.7\nprivate evidence"),
      },
    ]);
    expect(file?.fileName).toBe("crossing.pdf");
    expect(file?.contentType).toBe("application/pdf");
    expect(file?.data.byteLength).toBeGreaterThan(0);
  });

  it("rejects a content type that does not match the file signature", async () => {
    await expect(
      validateEvidence([
        {
          fileName: "fake.png",
          contentType: "image/png",
          data: btoa("not a PNG"),
        },
      ]),
    ).rejects.toBeInstanceOf(InvalidEvidenceError);
  });

  it("rejects unsupported content types and malformed base64", async () => {
    await expect(
      validateEvidence([
        {
          fileName: "script.svg",
          contentType: "image/svg+xml",
          data: btoa("<svg></svg>"),
        },
      ]),
    ).rejects.toBeInstanceOf(InvalidEvidenceError);
    await expect(
      validateEvidence([
        {
          fileName: "broken.pdf",
          contentType: "application/pdf",
          data: "not base64!",
        },
      ]),
    ).rejects.toBeInstanceOf(InvalidEvidenceError);
  });
});

describe("emergency feedback handling", () => {
  it.each([
    ["en", "call 911"],
    ["fr", "appelez le 911"],
  ])(
    "redirects %s emergencies before any D1 or R2 access",
    async (locale, expectedText) => {
      const failIfUsed = () => {
        throw new Error("Emergency requests must not touch persistence.");
      };
      const context: FeedbackContext = {
        env: {
          DB: {
            prepare: failIfUsed,
            batch: failIfUsed,
          } as unknown as D1Database,
          PRIVATE_ASSETS: {} as R2Bucket,
          APP_ENV: "development",
        },
        requestId: "test-request",
        cors: new Headers(),
      };
      const response = await handleFeedbackRequest(
        new Request("https://example.test/api/v1/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emergency: true, locale }),
        }),
        new URL("https://example.test/api/v1/feedback"),
        context,
      );
      const body = (await response!.json()) as {
        accepted: boolean;
        emergencyRedirect: { number: string; message: string };
      };
      expect(response?.status).toBe(422);
      expect(body.accepted).toBe(false);
      expect(body.emergencyRedirect.number).toBe("911");
      expect(body.emergencyRedirect.message.toLowerCase()).toContain(
        expectedText,
      );
    },
  );
});

describe("resident receipt reopen", () => {
  it.each(["closed", "outcome_recorded"] as const)(
    "reopens a %s receipt with new information and replays idempotently",
    async (initialStatus) => {
      const token = "a1".repeat(32);
      const tokenHash = await sha256Hex(token);
      const store = new FeedbackStore(initialStatus, tokenHash);
      const context = store.context();
      const path = `/api/v1/feedback/receipts/${store.submission.id}/reopen`;
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Receipt-Token": token,
          "Idempotency-Key": "resident-reopen-test-001",
          "CF-Connecting-IP": "198.51.100.10",
        },
        body: JSON.stringify({ message: "The crossing is still blocked." }),
      };

      const first = await handleFeedbackRequest(
        new Request(`https://example.test${path}`, options),
        new URL(`https://example.test${path}`),
        context,
      );
      const firstBody = (await first!.json()) as {
        submission: { status: string; messages: Array<{ body: string }> };
      };
      expect(first?.status).toBe(200);
      expect(firstBody.submission.status).toBe("reopened");
      expect(firstBody.submission.messages.map(({ body }) => body)).toEqual([
        "The crossing is still blocked.",
      ]);
      expect(store.submission.status).toBe("reopened");
      expect(store.abuseCount).toBe(1);

      const retry = await handleFeedbackRequest(
        new Request(`https://example.test${path}`, options),
        new URL(`https://example.test${path}`),
        context,
      );
      const retryBody = (await retry!.json()) as {
        submission: { status: string; messages: Array<{ body: string }> };
      };
      expect(retry?.status).toBe(200);
      expect(retryBody.submission.messages).toHaveLength(1);
      expect(store.abuseCount).toBe(1);
    },
  );

  it("returns a requested-information case to review when its receipt owner replies", async () => {
    const token = "b2".repeat(32);
    const store = new FeedbackStore(
      "waiting_on_resident",
      await sha256Hex(token),
    );
    const context = store.context();
    const path = `/api/v1/feedback/receipts/${store.submission.id}/messages`;
    const response = await handleFeedbackRequest(
      new Request(`https://example.test${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Receipt-Token": token,
          "Idempotency-Key": "resident-reply-test-001",
          "CF-Connecting-IP": "198.51.100.11",
        },
        body: JSON.stringify({ message: "The intersection is Queen and Bay." }),
      }),
      new URL(`https://example.test${path}`),
      context,
    );
    expect(response?.status).toBe(200);
    expect(store.submission.status).toBe("in_review");
    expect(store.messages.map(({ body }) => body)).toEqual([
      "The intersection is Queen and Bay.",
    ]);
  });
});

describe("private evidence authorization", () => {
  it("does not read R2 for a different organization", async () => {
    const get = vi.fn(async () => null);
    const context = evidenceContext({
      first: async () => null,
      get,
    });
    const response = await downloadEvidence(context, {
      submissionId: "fb_0123456789abcdef0123456789abcdef",
      assetId: "asset_0123456789abcdef0123456789abcdef",
      organizationId: "org_other",
    });
    expect(response).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("does not read R2 when a receipt token does not match the owner", async () => {
    const get = vi.fn(async () => null);
    const row = evidenceRow();
    let firstCall = 0;
    const context = evidenceContext({
      first: async () => (firstCall++ === 0 ? row : null),
      get,
    });
    const response = await downloadEvidence(context, {
      submissionId: row.record_id,
      assetId: row.id,
      organizationId: "org_sample",
      tokenHash: "wrong-receipt-token-hash",
    });
    expect(response).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("guest abuse limits", () => {
  it("fails closed when the HMAC secret is missing", async () => {
    const prepare = vi.fn(() => {
      throw new Error("The database should not be reached.");
    });
    const context: FeedbackContext = {
      env: {
        DB: { prepare } as unknown as D1Database,
        PRIVATE_ASSETS: {} as R2Bucket,
        APP_ENV: "production",
      },
      requestId: "test-request",
      cors: new Headers(),
    };
    const response = await enforceGuestAbuseLimit(
      new Request("https://example.test/api/v1/feedback", {
        headers: { "CF-Connecting-IP": "198.51.100.12" },
      }),
      context,
      "create",
    );
    expect(response?.status).toBe(503);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("stores only a keyed digest of the edge IP", async () => {
    const edgeAddress = "198.51.100.13";
    let rateLimitBindings: unknown[] = [];
    const database = {
      prepare(query: string) {
        const statement = {
          bind(...values: unknown[]) {
            if (query.includes("INSERT INTO feedback_abuse_counters"))
              rateLimitBindings = values;
            return statement;
          },
          async run() {
            return { success: true, meta: emptyMeta() };
          },
          async first() {
            return { request_count: 1 };
          },
          async all() {
            return { results: [], success: true, meta: emptyMeta() };
          },
        };
        return statement;
      },
      async batch() {
        return [];
      },
    };
    const context: FeedbackContext = {
      env: {
        DB: database as unknown as D1Database,
        PRIVATE_ASSETS: {} as R2Bucket,
        FEEDBACK_ABUSE_HMAC_KEY: "test-only-hmac-key-never-used-in-production",
        APP_ENV: "development",
      },
      requestId: "test-request",
      cors: new Headers(),
    };
    const response = await enforceGuestAbuseLimit(
      new Request("https://example.test/api/v1/feedback", {
        headers: { "CF-Connecting-IP": edgeAddress },
      }),
      context,
      "create",
    );
    expect(response).toBeNull();
    expect(rateLimitBindings[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(rateLimitBindings).not.toContain(edgeAddress);
  });
});

class FeedbackStore {
  readonly submission: FeedbackRow & { organization_id: string };
  readonly messages: Array<{
    id: string;
    author_kind: "resident" | "staff";
    body: string;
    created_at: string;
  }> = [];
  readonly idempotency = new Map<
    string,
    { request_hash: string; response_json: string }
  >();
  abuseCount = 0;

  constructor(
    status: "closed" | "outcome_recorded" | "waiting_on_resident",
    tokenHash: string,
  ) {
    this.submission = {
      id: "fb_0123456789abcdef0123456789abcdef",
      original_text: "The crossing light is too short.",
      constructive_follow_up: null,
      category: "roads_and_sidewalks",
      municipality_csd_uid: "3520005",
      municipality_name: "Toronto",
      province_name: "Ontario",
      status,
      receipt_token_hash: tokenHash,
      department_name: "General review (fictional Toronto sandbox)",
      outcome: status === "outcome_recorded" ? "Work was scheduled." : null,
      sample: 1,
      created_at: "2026-09-26T12:00:00.000Z",
      updated_at: "2026-09-26T12:00:00.000Z",
      organization_id: "org_43G1B1RhPwac7EjS",
    };
  }

  context(): FeedbackContext {
    const store = this;
    const database = {
      prepare(query: string) {
        let values: unknown[] = [];
        const statement = {
          query,
          get values() {
            return values;
          },
          bind(...bound: unknown[]) {
            values = bound;
            return statement;
          },
          async first<Row>() {
            if (query.includes("FROM feedback_submissions AS f")) {
              return values[0] === store.submission.id &&
                values[1] === store.submission.receipt_token_hash
                ? ({ ...store.submission } as Row)
                : null;
            }
            if (query.includes("FROM idempotency_records"))
              return (store.idempotency.get(String(values[0])) ??
                null) as Row | null;
            if (query.includes("FROM feedback_messages"))
              return (store.messages.find(
                (message) =>
                  message.id === values[1] &&
                  message.id &&
                  (values[0] === store.submission.id ||
                    values[0] === undefined),
              ) ?? null) as Row | null;
            if (query.includes("RETURNING request_count")) {
              store.abuseCount += 1;
              return { request_count: store.abuseCount } as Row;
            }
            return null;
          },
          async all<Row>() {
            if (query.includes("FROM feedback_messages"))
              return {
                results: store.messages as Row[],
                success: true,
                meta: emptyMeta(),
              };
            return { results: [] as Row[], success: true, meta: emptyMeta() };
          },
          async run<Row>() {
            return { results: [] as Row[], success: true, meta: emptyMeta() };
          },
        };
        return statement as unknown as D1PreparedStatement;
      },
      async batch(statements: D1PreparedStatement[]) {
        for (const statement of statements) {
          const { query, values } = statement as unknown as {
            query: string;
            values: unknown[];
          };
          if (
            query.includes(
              "UPDATE feedback_submissions SET status = 'reopened'",
            )
          ) {
            if (
              values[1] === store.submission.id &&
              values[2] === store.submission.receipt_token_hash &&
              values[3] === store.submission.status
            ) {
              store.submission.status = "reopened";
            }
          } else if (
            query.includes(
              "UPDATE feedback_submissions SET status = 'in_review'",
            )
          ) {
            if (
              values[1] === store.submission.id &&
              values[2] === store.submission.receipt_token_hash &&
              store.submission.status === "waiting_on_resident"
            ) {
              store.submission.status = "in_review";
            }
          } else if (
            query.includes("INSERT OR IGNORE INTO feedback_messages")
          ) {
            store.messages.push({
              id: String(values[0]),
              author_kind: "resident",
              body: String(values[4]),
              created_at: String(values[5]),
            });
          } else if (
            query.includes("INSERT OR IGNORE INTO idempotency_records")
          ) {
            store.idempotency.set(String(values[0]), {
              request_hash: String(values[1]),
              response_json: String(values[4]),
            });
          }
        }
        return [];
      },
    };
    return {
      env: {
        DB: database as unknown as D1Database,
        PRIVATE_ASSETS: {} as R2Bucket,
        FEEDBACK_ABUSE_HMAC_KEY: "test-only-hmac-key-never-used-in-production",
        APP_ENV: "development",
      },
      requestId: "test-request",
      cors: new Headers(),
    };
  }
}

function evidenceContext(options: {
  first: () => Promise<unknown | null>;
  get: () => Promise<null>;
}): FeedbackContext {
  let firstCalled = false;
  const database = {
    prepare() {
      const statement = {
        bind() {
          return statement;
        },
        async first() {
          if (firstCalled) return null;
          firstCalled = true;
          return options.first();
        },
        async all() {
          return { results: [], success: true, meta: emptyMeta() };
        },
        async run() {
          return { results: [], success: true, meta: emptyMeta() };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return {
    env: {
      DB: database as unknown as D1Database,
      PRIVATE_ASSETS: { get: options.get } as unknown as R2Bucket,
      APP_ENV: "development",
    },
    requestId: "test-request",
    cors: new Headers(),
  };
}

function evidenceRow() {
  return {
    id: "asset_0123456789abcdef0123456789abcdef",
    organization_id: "org_sample",
    owner_subject: "guest:fb_0123456789abcdef0123456789abcdef",
    purpose: "feedback_attachment" as const,
    record_id: "fb_0123456789abcdef0123456789abcdef",
    object_key: "private/feedback_attachment/org_sample/guest/test/asset",
    filename: "evidence.pdf",
    content_type: "application/pdf",
    byte_size: 12,
    created_at: "2026-09-26T12:00:00.000Z",
  };
}

function emptyMeta() {
  return {
    changes: 0,
    duration: 0,
    last_row_id: 0,
    rows_read: 0,
    rows_written: 0,
  };
}
