import { describe, expect, it, vi } from "vitest";
import {
  areStrongFeedbackDuplicates,
  canStaffRecordOutcome,
  canStaffRequestDetails,
  canResidentReopenFeedback,
  canTransitionFeedback,
  isFeedbackCategory,
  normalizeFeedbackDuplicateText,
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

  it("allows staff requests and outcomes only from in_review", () => {
    expect(canStaffRequestDetails("in_review")).toBe(true);
    expect(canStaffRequestDetails("submitted")).toBe(false);
    expect(canStaffRequestDetails("reopened")).toBe(false);
    expect(canStaffRecordOutcome("in_review")).toBe(true);
    expect(canStaffRecordOutcome("waiting_on_resident")).toBe(false);
    expect(canStaffRecordOutcome("closed")).toBe(false);
  });

  it("accepts only the routed feedback categories", () => {
    expect(isFeedbackCategory("other_or_unsure")).toBe(true);
    expect(isFeedbackCategory("made_up_department")).toBe(false);
  });

  it("matches only substantial, near-identical normalized descriptions", () => {
    const original =
      "The pedestrian crossing signal at Queen Street and Lansdowne Avenue stays green for only a few seconds each evening.";
    const equivalent =
      "The pedestrian crossing signal at Queen St. and Lansdowne Avenue stays green for only a few seconds each evening.";
    const distinct =
      "The pedestrian crossing signal at Queen Street and Lansdowne Avenue is broken, and cars do not stop for people walking.";

    expect(
      normalizeFeedbackDuplicateText("Broken light on the road"),
    ).toBeNull();
    expect(areStrongFeedbackDuplicates(original, equivalent)).toBe(true);
    expect(areStrongFeedbackDuplicates(original, distinct)).toBe(false);
    expect(
      areStrongFeedbackDuplicates(original, "Broken light on the road"),
    ).toBe(false);
  });

  it("ignores only a leading practice label when matching seeded reports", () => {
    const seeded =
      "[Practice] A deep pothole has formed near a pedestrian crossing on Bloor Street West. Could the road surface be checked?";
    const residentText =
      "A deep pothole has formed near a pedestrian crossing on Bloor Street West. Could the road surface be checked?";

    expect(normalizeFeedbackDuplicateText(seeded)).toBe(
      normalizeFeedbackDuplicateText(residentText),
    );
    expect(areStrongFeedbackDuplicates(seeded, residentText)).toBe(true);
    expect(
      normalizeFeedbackDuplicateText(
        "A [Practice] label appears inside this substantial report about a pedestrian crossing signal on Bloor Street West.",
      ),
    ).toContain("practice");
  });
});

describe("guest feedback duplicate checks", () => {
  const repeatedReport =
    "The pedestrian crossing signal at Queen Street and Lansdowne Avenue stays green for only a few seconds each evening.";

  it("returns only the matching case status from the preview endpoint", async () => {
    const store = new GuestDuplicateStore([
      {
        original_text:
          "The pedestrian crossing signal at Queen St. and Lansdowne Avenue stays green for only a few seconds each evening.",
        status: "in_review",
      },
    ]);
    const path = "/api/v1/feedback/duplicate-check";
    const response = await handleFeedbackRequest(
      guestFeedbackRequest(path, {
        message: repeatedReport,
        municipalityId: "3520005",
      }),
      new URL("https://example.test/api/v1/feedback/duplicate-check"),
      store.context(),
    );

    expect(response?.status).toBe(200);
    const body = (await response!.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ duplicate: { status: "in_review" } });
    expect(body).not.toHaveProperty("submission");
    expect(body).not.toHaveProperty("receiptToken");
    expect(JSON.stringify(body)).not.toContain("Queen");
    expect(JSON.stringify(body)).not.toContain("fb_");
  });

  it("does not search for a duplicate for short descriptions", async () => {
    const store = new GuestDuplicateStore([
      { original_text: "The crossing light is broken.", status: "submitted" },
    ]);
    const response = await handleFeedbackRequest(
      guestFeedbackRequest("/api/v1/feedback/duplicate-check", {
        message: "The crossing light is broken.",
        municipalityId: "3520005",
      }),
      new URL("https://example.test/api/v1/feedback/duplicate-check"),
      store.context(),
    );

    expect(response?.status).toBe(200);
    expect(await response!.json()).toMatchObject({ duplicate: null });
    expect(store.duplicateQueryCount).toBe(0);
  });

  it("matches an unresolved report outside the recent time window", async () => {
    const store = new GuestDuplicateStore([
      {
        original_text:
          "The pedestrian crossing signal at Queen St. and Lansdowne Avenue stays green for only a few seconds each evening.",
        status: "in_review",
        created_at: new Date(
          Date.now() - 365 * 24 * 60 * 60 * 1_000,
        ).toISOString(),
      },
    ]);
    const response = await handleFeedbackRequest(
      guestFeedbackRequest("/api/v1/feedback/duplicate-check", {
        message: repeatedReport,
        municipalityId: "3520005",
      }),
      new URL("https://example.test/api/v1/feedback/duplicate-check"),
      store.context(),
    );

    expect(response?.status).toBe(200);
    expect(await response!.json()).toMatchObject({
      duplicate: { status: "in_review" },
    });
    expect(store.duplicateQuerySql).not.toMatch(/created_at\s*>=/i);
    expect(store.duplicateQuerySql).toMatch(/LIMIT\s+500/i);
  });

  it("returns a status-only duplicate outcome at creation", async () => {
    const store = new GuestDuplicateStore([
      { original_text: repeatedReport, status: "waiting_on_resident" },
    ]);
    const path = "/api/v1/feedback";
    const response = await handleFeedbackRequest(
      guestFeedbackRequest(
        path,
        {
          message: repeatedReport,
          municipalityId: "3520005",
          sandboxAcknowledged: true,
        },
        {
          "Idempotency-Key": "duplicate-submit-test-01",
          "X-Receipt-Token": "ab".repeat(32),
        },
      ),
      new URL("https://example.test/api/v1/feedback"),
      store.context(),
    );

    expect(response?.status).toBe(200);
    const body = (await response!.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      result: "duplicate",
      created: false,
      duplicate: { status: "waiting_on_resident" },
    });
    expect(body).not.toHaveProperty("submission");
    expect(body).not.toHaveProperty("receiptToken");
    expect(store.batchCount).toBe(0);
  });
});

describe("staff feedback authorization", () => {
  it("requires authentication for assignment options", async () => {
    const unused = () => {
      throw new Error("Unauthenticated requests must not access D1.");
    };
    const context: FeedbackContext = {
      env: {
        DB: { prepare: unused } as unknown as D1Database,
        PRIVATE_ASSETS: {} as R2Bucket,
        APP_ENV: "development",
      },
      requestId: "test-request",
      cors: new Headers(),
    };
    const path =
      "/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback/assignment-options";
    const response = await handleFeedbackRequest(
      new Request(`https://example.test${path}`),
      new URL(`https://example.test${path}`),
      context,
    );
    expect(response?.status).toBe(401);
  });

  it("denies hiring-only reviewers access to assignment options", async () => {
    const database = authOnlyDatabase("hiring_reviewer");
    const context: FeedbackContext = {
      env: {
        DB: database,
        PRIVATE_ASSETS: {} as R2Bucket,
        APP_ENV: "development",
        DEV_AUTH_ENABLED: "true",
      },
      requestId: "test-request",
      cors: new Headers(),
    };
    const path =
      "/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback/assignment-options";
    const response = await handleFeedbackRequest(
      new Request(`https://example.test${path}`, {
        headers: { Authorization: "Bearer dev-hiring-reviewer" },
      }),
      new URL(`https://example.test${path}`),
      context,
    );
    expect(response?.status).toBe(403);
  });
});

describe("scoped staff feedback workflow", () => {
  it("assigns only active departments and same-organization staff", async () => {
    const store = new StaffWorkflowStore("d1".repeat(32));
    const context = store.context();
    const optionsPath =
      "/api/v1/staff/organizations/org_43G1B1RhPwac7EjS/feedback/assignment-options";
    const optionsResponse = await handleFeedbackRequest(
      new Request(`https://example.test${optionsPath}`, {
        headers: { Authorization: "Bearer dev-civic-staff" },
      }),
      new URL(`https://example.test${optionsPath}`),
      context,
    );
    const options = (await optionsResponse!.json()) as {
      departments: Array<{ id: string }>;
      assignees: Array<{ subject: string; displayLabel: string }>;
    };
    expect(optionsResponse?.status).toBe(200);
    expect(options.departments.map(({ id }) => id)).toEqual(["general_review"]);
    expect(options.assignees.map(({ subject }) => subject)).toEqual([
      "local:civic-staff",
      "local:organization-admin",
    ]);
    expect(options.assignees.map(({ displayLabel }) => displayLabel)).toEqual([
      "Civic staff member 1",
      "Organization admin 1",
    ]);

    const path = `${optionsPath.replace("/assignment-options", "")}/${store.submission.id}/assignment`;
    const headers = {
      Authorization: "Bearer dev-civic-staff",
      "Content-Type": "application/json",
      "Idempotency-Key": "assignment-local-test-1",
    };
    const response = await handleFeedbackRequest(
      new Request(`https://example.test${path}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          departmentId: "general_review",
          assigneeSubject: "local:organization-admin",
        }),
      }),
      new URL(`https://example.test${path}`),
      context,
    );
    const body = (await response!.json()) as {
      assignment: { departmentId: string; assigneeSubject: string | null };
    };
    expect(response?.status).toBe(200);
    expect(body.assignment).toMatchObject({
      departmentId: "general_review",
      assigneeSubject: "local:organization-admin",
    });
    expect(store.assignment?.assignee_subject).toBe("local:organization-admin");

    const denied = await handleFeedbackRequest(
      new Request(`https://example.test${path}`, {
        method: "PATCH",
        headers: { ...headers, "Idempotency-Key": "assignment-local-test-2" },
        body: JSON.stringify({
          departmentId: "general_review",
          assigneeSubject: "local:hiring-reviewer",
        }),
      }),
      new URL(`https://example.test${path}`),
      context,
    );
    expect(denied?.status).toBe(422);
    expect(store.assignment?.assignee_subject).toBe("local:organization-admin");
  });

  it("requests resident details and exposes the question in the private receipt", async () => {
    const token = "e3".repeat(32);
    const store = new StaffWorkflowStore(await sha256Hex(token));
    const context = store.context();
    const path = `/api/v1/staff/organizations/${store.organizationId}/feedback/${store.submission.id}/request-details`;
    const response = await handleFeedbackRequest(
      new Request(`https://example.test${path}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-civic-staff",
          "Content-Type": "application/json",
          "Idempotency-Key": "request-details-test-1",
        },
        body: JSON.stringify({ message: "Which corner is affected?" }),
      }),
      new URL(`https://example.test${path}`),
      context,
    );
    const body = (await response!.json()) as {
      message: { body: string };
      submission: { status: string };
    };
    expect(response?.status).toBe(200);
    expect(body.submission.status).toBe("waiting_on_resident");
    expect(body.message.body).toBe("Which corner is affected?");

    const receiptPath = `/api/v1/feedback/receipts/${store.submission.id}`;
    const receiptResponse = await handleFeedbackRequest(
      new Request(`https://example.test${receiptPath}`, {
        headers: { "X-Receipt-Token": token },
      }),
      new URL(`https://example.test${receiptPath}`),
      context,
    );
    const receipt = (await receiptResponse!.json()) as {
      submission: { status: string; messages: Array<{ body: string }> };
    };
    expect(receipt.submission.status).toBe("waiting_on_resident");
    expect(receipt.submission.messages.map(({ body }) => body)).toEqual([
      "The crossing light is too short.",
      "Which corner is affected?",
    ]);
  });

  it("records outcomes only from review and exposes the summary to the receipt owner", async () => {
    const token = "f4".repeat(32);
    const store = new StaffWorkflowStore(await sha256Hex(token));
    const context = store.context();
    const path = `/api/v1/staff/organizations/${store.organizationId}/feedback/${store.submission.id}/outcome`;
    const request = () =>
      handleFeedbackRequest(
        new Request(`https://example.test${path}`, {
          method: "POST",
          headers: {
            Authorization: "Bearer dev-civic-staff",
            "Content-Type": "application/json",
            "Idempotency-Key": "record-outcome-test-1",
          },
          body: JSON.stringify({ summary: "The light was repaired." }),
        }),
        new URL(`https://example.test${path}`),
        context,
      );
    const response = await request();
    const body = (await response!.json()) as {
      submission: { status: string; outcome: string };
    };
    expect(response?.status).toBe(200);
    expect(body.submission).toEqual({
      id: store.submission.id,
      status: "outcome_recorded",
      outcome: "The light was repaired.",
    });
    expect(store.submission.status).toBe("outcome_recorded");

    const receiptPath = `/api/v1/feedback/receipts/${store.submission.id}`;
    const receiptResponse = await handleFeedbackRequest(
      new Request(`https://example.test${receiptPath}`, {
        headers: { "X-Receipt-Token": token },
      }),
      new URL(`https://example.test${receiptPath}`),
      context,
    );
    const receipt = (await receiptResponse!.json()) as {
      submission: { status: string; outcome: string };
    };
    expect(receipt.submission).toMatchObject({
      status: "outcome_recorded",
      outcome: "The light was repaired.",
    });

    const retry = await request();
    expect(retry?.status).toBe(200);
    expect(store.submission.status).toBe("outcome_recorded");
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

class GuestDuplicateStore {
  duplicateQueryCount = 0;
  duplicateQuerySql = "";
  batchCount = 0;
  private readonly candidates: Array<{
    original_text: string;
    status: FeedbackRow["status"];
    organization_id: string;
    municipality_csd_uid: string;
    category: string;
    created_at: string;
  }>;

  constructor(
    candidates: Array<{
      original_text: string;
      status: FeedbackRow["status"];
      created_at?: string;
    }>,
  ) {
    this.candidates = candidates.map((candidate) => ({
      ...candidate,
      organization_id: "org_43G1B1RhPwac7EjS",
      municipality_csd_uid: "3520005",
      category: "other_or_unsure",
      created_at: candidate.created_at ?? new Date().toISOString(),
    }));
  }

  context(): FeedbackContext {
    const store = this;
    const database = {
      prepare(query: string) {
        let values: unknown[] = [];
        const statement = {
          bind(...bound: unknown[]) {
            values = bound;
            return statement;
          },
          async first<Row>() {
            if (query.includes("FROM feedback_destinations AS d"))
              return {
                organization_id: "org_43G1B1RhPwac7EjS",
                routing_label: "General review (fictional Toronto sandbox)",
                sample: 1,
                municipality_csd_uid: "3520005",
                municipality_name: "Toronto",
                province_name: "Ontario",
              } as Row;
            if (query.includes("INSERT INTO feedback_abuse_counters"))
              return { request_count: 1 } as Row;
            return null;
          },
          async all<Row>() {
            if (query.includes("SELECT original_text, status")) {
              store.duplicateQueryCount += 1;
              store.duplicateQuerySql = query;
              const limit = Number(query.match(/LIMIT\s+(\d+)/i)?.[1] ?? 0);
              return {
                results: store.candidates
                  .filter(
                    (candidate) =>
                      candidate.organization_id === values[0] &&
                      candidate.municipality_csd_uid === values[1] &&
                      candidate.category === values[2],
                  )
                  .sort((left, right) => {
                    const leftResolved =
                      left.status === "closed" ||
                      left.status === "outcome_recorded";
                    const rightResolved =
                      right.status === "closed" ||
                      right.status === "outcome_recorded";
                    return (
                      Number(leftResolved) - Number(rightResolved) ||
                      right.created_at.localeCompare(left.created_at)
                    );
                  })
                  .slice(0, limit) as Row[],
                success: true,
                meta: emptyMeta(),
              };
            }
            return { results: [] as Row[], success: true, meta: emptyMeta() };
          },
          async run() {
            return { success: true, meta: emptyMeta() };
          },
        };
        return statement as unknown as D1PreparedStatement;
      },
      async batch() {
        store.batchCount += 1;
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

function guestFeedbackRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(new URL(path, "https://example.test"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.5",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

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

class StaffWorkflowStore {
  readonly organizationId = "org_43G1B1RhPwac7EjS";
  readonly submission: FeedbackRow & { organization_id: string };
  readonly messages: Array<{
    id: string;
    author_kind: "resident" | "staff";
    body: string;
    created_at: string;
  }> = [
    {
      id: "fbm_initial",
      author_kind: "resident" as const,
      body: "The crossing light is too short.",
      created_at: "2026-09-26T12:00:00.000Z",
    },
  ];
  readonly idempotency = new Map<
    string,
    { request_hash: string; response_json: string }
  >();
  assignment: {
    submission_id: string;
    organization_id: string;
    department_id: string;
    department_name_en: string;
    department_name_fr: string;
    assignee_subject: string | null;
    assigned_by: string;
    updated_at: string;
  } | null = null;
  private updatedAt = "2026-09-26T12:00:00.000Z";
  private readonly departments = [
    {
      id: "general_review",
      name_en: "CivicResolve general review",
      name_fr: "Examen général de CivicResolve",
      active: 1,
      jurisdiction_level: "review_only",
      organization_id: "org_43G1B1RhPwac7EjS",
    },
    {
      id: "inactive_department",
      name_en: "Inactive department",
      name_fr: "Service inactif",
      active: 0,
      jurisdiction_level: "review_only",
      organization_id: "org_43G1B1RhPwac7EjS",
    },
  ];
  private readonly memberships = [
    {
      user_subject: "local:civic-staff",
      organization_id: "org_43G1B1RhPwac7EjS",
      role: "civic_staff" as const,
    },
    {
      user_subject: "local:organization-admin",
      organization_id: "org_43G1B1RhPwac7EjS",
      role: "organization_admin" as const,
    },
    {
      user_subject: "local:hiring-reviewer",
      organization_id: "org_43G1B1RhPwac7EjS",
      role: "hiring_reviewer" as const,
    },
    {
      user_subject: "local:other-civic-staff",
      organization_id: "org_local_other",
      role: "civic_staff" as const,
    },
  ];

  constructor(receiptTokenHash: string) {
    this.submission = {
      id: "fb_0123456789abcdef0123456789abcdef",
      original_text: "The crossing light is too short.",
      constructive_follow_up: "Repair the signal timing.",
      category: "roads_and_sidewalks",
      municipality_csd_uid: "3520005",
      municipality_name: "Toronto",
      province_name: "Ontario",
      status: "in_review",
      receipt_token_hash: receiptTokenHash,
      department_name: "General review (fictional Toronto sandbox)",
      outcome: null,
      sample: 1,
      created_at: "2026-09-26T12:00:00.000Z",
      updated_at: this.updatedAt,
      organization_id: this.organizationId,
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
            if (query.includes("FROM idempotency_records"))
              return (store.idempotency.get(String(values[0])) ??
                null) as Row | null;
            if (query.includes("FROM feedback_submissions AS f")) {
              const matches =
                values[0] === store.submission.id &&
                (query.includes("receipt_token_hash = ?")
                  ? values[1] === store.submission.receipt_token_hash
                  : values[1] === store.organizationId);
              return matches ? ({ ...store.submission } as Row) : null;
            }
            if (query.includes("FROM taxonomy_departments")) {
              return (store.departments.find(
                (department) =>
                  department.id === values[0] &&
                  department.organization_id === values[1] &&
                  department.active === 1,
              ) ?? null) as Row | null;
            }
            if (query.includes("FROM organization_memberships")) {
              return (store.memberships.find(
                (member) =>
                  member.user_subject === values[0] &&
                  member.organization_id === values[1] &&
                  (member.role === "civic_staff" ||
                    member.role === "organization_admin"),
              ) ?? null) as Row | null;
            }
            if (query.includes("FROM feedback_staff_assignments AS a"))
              return (
                store.assignment &&
                store.assignment.submission_id === values[0] &&
                store.assignment.organization_id === values[1]
                  ? store.assignment
                  : null
              ) as Row | null;
            if (query.includes("FROM feedback_messages"))
              return (store.messages.find(
                (message) =>
                  message.id === values[1] && values[0] === store.submission.id,
              ) ?? null) as Row | null;
            return null;
          },
          async all<Row>() {
            if (query.includes("JOIN organizations AS o")) {
              const [subject, auth0OrganizationId, ...roles] =
                values.map(String);
              const orgId = auth0OrganizationId;
              return {
                results: store.memberships
                  .filter(
                    (member) =>
                      member.user_subject === subject &&
                      member.organization_id === orgId &&
                      roles.includes(member.role),
                  )
                  .map(({ organization_id, role }) => ({
                    organization_id,
                    role,
                  })) as Row[],
                success: true,
                meta: emptyMeta(),
              };
            }
            if (query.includes("FROM taxonomy_departments"))
              return {
                results: store.departments.filter(
                  (department) =>
                    department.organization_id === values[0] &&
                    department.active === 1,
                ) as Row[],
                success: true,
                meta: emptyMeta(),
              };
            if (query.includes("FROM organization_memberships"))
              return {
                results: store.memberships.filter(
                  (member) =>
                    member.organization_id === values[0] &&
                    (member.role === "civic_staff" ||
                      member.role === "organization_admin"),
                ) as Row[],
                success: true,
                meta: emptyMeta(),
              };
            if (query.includes("FROM feedback_messages"))
              return {
                results: store.messages as Row[],
                success: true,
                meta: emptyMeta(),
              };
            return { results: [] as Row[], success: true, meta: emptyMeta() };
          },
          async run() {
            return { success: true, meta: emptyMeta() };
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
          if (query.startsWith("UPDATE feedback_submissions")) {
            if (query.includes("outcome = ?")) {
              if (
                values[3] === store.submission.id &&
                values[4] === store.organizationId &&
                values[5] === store.submission.status
              ) {
                store.submission.status = String(
                  values[0],
                ) as FeedbackRow["status"];
                store.submission.outcome = String(values[1]);
                store.updatedAt = String(values[2]);
                store.submission.updated_at = store.updatedAt;
              }
            } else if (query.includes("SET status = ?")) {
              if (
                values[2] === store.submission.id &&
                values[3] === store.organizationId &&
                values[4] === store.submission.status
              ) {
                store.submission.status = String(
                  values[0],
                ) as FeedbackRow["status"];
                store.updatedAt = String(values[1]);
                store.submission.updated_at = store.updatedAt;
              }
            } else if (
              values[1] === store.submission.id &&
              values[2] === store.organizationId
            ) {
              store.updatedAt = String(values[0]);
              store.submission.updated_at = store.updatedAt;
            }
          } else if (
            query.startsWith("INSERT INTO feedback_staff_assignments")
          ) {
            const department = store.departments.find(
              (item) => item.id === values[2],
            )!;
            store.assignment = {
              submission_id: String(values[0]),
              organization_id: String(values[1]),
              department_id: String(values[2]),
              department_name_en: department.name_en,
              department_name_fr: department.name_fr,
              assignee_subject: values[3] as string | null,
              assigned_by: String(values[4]),
              updated_at: String(values[5]),
            };
          } else if (
            query.includes("INSERT OR IGNORE INTO feedback_messages")
          ) {
            store.messages.push({
              id: String(values[0]),
              author_kind: String(values[2]) as "resident" | "staff",
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
        APP_ENV: "development",
        DEV_AUTH_ENABLED: "true",
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

function authOnlyDatabase(role: string): D1Database {
  return {
    prepare(query: string) {
      const statement = {
        bind() {
          return statement;
        },
        async all() {
          return {
            results: query.includes("JOIN organizations AS o")
              ? [
                  {
                    organization_id: "org_43G1B1RhPwac7EjS",
                    role,
                  },
                ]
              : [],
            success: true,
            meta: emptyMeta(),
          };
        },
        async first() {
          return null;
        },
        async run() {
          return { success: true, meta: emptyMeta() };
        },
      };
      return statement as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}
