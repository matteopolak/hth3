import { describe, expect, it } from "vitest";
import type { D1Database, R2Bucket } from "@civicresolve/db/d1";
import { enforceGuestAbuseLimit } from "./abuse.js";
import type { FeedbackContext } from "./types.js";

describe("duplicate preview abuse budget", () => {
  it("caps distinct and repeated checks independently without storing input", async () => {
    const counters = new Map<string, { window: number; count: number }>();
    const bindings: unknown[][] = [];
    const database = {
      prepare(sql: string) {
        let values: unknown[] = [];
        const statement = {
          bind(...next: unknown[]) {
            values = next;
            return statement;
          },
          async run() {
            return { success: true };
          },
          async first() {
            if (sql.startsWith("SELECT window_started_at")) {
              const row = counters.get(String(values[0]));
              return row
                ? { window_started_at: row.window, request_count: row.count }
                : null;
            }
            bindings.push(values);
            const key = String(values[0]);
            const window = Number(values[2]);
            const limit = Number(values[3]);
            const previous = counters.get(key);
            const count = previous?.window === window ? previous.count + 1 : 1;
            if (count > limit) return null;
            counters.set(key, { window, count });
            return { request_count: count };
          },
        };
        return statement;
      },
    };
    const context: FeedbackContext = {
      env: {
        DB: database as unknown as D1Database,
        PRIVATE_ASSETS: {} as R2Bucket,
        APP_ENV: "development",
        FEEDBACK_ABUSE_HMAC_KEY: "test-only-hmac-key-never-used-in-production",
      },
      requestId: "rate-test",
      cors: new Headers(),
    };
    const request = new Request("https://example.test/duplicate-check", {
      headers: { "CF-Connecting-IP": "198.51.100.28" },
    });
    const check = (key: string) =>
      enforceGuestAbuseLimit(request, context, "create", {
        bucketNamespace: "duplicate-check-v2",
        repeatKey: key,
      });

    for (let repeat = 0; repeat < 16; repeat++)
      expect(await check("same practice concern")).toBeNull();
    expect((await check("same practice concern"))?.status).toBe(429);
    for (let distinct = 1; distinct < 8; distinct++)
      expect(await check(`other concern ${distinct}`)).toBeNull();
    expect((await check("ninth distinct concern"))?.status).toBe(429);
    expect(
      bindings.flat().some((value) => String(value).includes("concern")),
    ).toBe(false);
    expect(
      [...counters.values()].filter((value) => value.count === 8),
    ).toHaveLength(1);
  });
});
