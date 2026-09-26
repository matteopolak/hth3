import { describe, expect, it } from "vitest";
import type { D1Database, D1Result, D1Value } from "@civicresolve/db/d1";
import {
  authenticateRequest,
  type AuthEnvironment,
} from "../src/auth/identity.js";
import { Auth0TokenError } from "../src/auth/jwt.js";

describe("request identity resolution", () => {
  it("intersects a fixed local staff principal with persisted membership", async () => {
    const environment = testEnvironment([
      { organization_id: "org_43G1B1RhPwac7EjS", role: "civic_staff" },
    ]);
    const actor = await authenticateRequest(
      new Request("https://worker.test", {
        headers: { Authorization: "Bearer dev-civic-staff" },
      }),
      environment,
    );

    expect(actor).toMatchObject({
      subject: "local:civic-staff",
      organizationId: "org_43G1B1RhPwac7EjS",
      roles: ["civic_staff"],
      permissions: ["read:feedback", "respond:feedback"],
      authMethod: "development",
    });
  });

  it("drops a claimed role when persisted membership is missing", async () => {
    const actor = await authenticateRequest(
      new Request("https://worker.test", {
        headers: { Authorization: "Bearer dev-civic-staff" },
      }),
      testEnvironment([]),
    );

    expect(actor?.roles).toEqual([]);
    expect(actor?.organizationId).toBeNull();
  });

  it("keeps applicant identity independent of employer membership", async () => {
    const actor = await authenticateRequest(
      new Request("https://worker.test", {
        headers: { Authorization: "Bearer dev-applicant" },
      }),
      testEnvironment([]),
    );

    expect(actor).toMatchObject({
      subject: "local:applicant",
      roles: ["applicant"],
      organizationId: null,
      permissions: [
        "write:applications",
        "read:applications",
        "submit:applications",
      ],
    });
  });

  it("never enables local principals in production, even if the flag is set", async () => {
    await expect(
      authenticateRequest(
        new Request("https://worker.test", {
          headers: { Authorization: "Bearer dev-organization-admin" },
        }),
        {
          ...testEnvironment([]),
          APP_ENV: "production",
          DEV_AUTH_ENABLED: "true",
        },
      ),
    ).rejects.toBeInstanceOf(Auth0TokenError);
  });
});

function testEnvironment(
  memberships: Array<{ organization_id: string; role: string }>,
): AuthEnvironment {
  const database = {
    prepare: () => {
      let boundValues: D1Value[] = [];
      const statement = {
        bind: (...values: D1Value[]) => {
          boundValues = values;
          return statement;
        },
        first: async () => null,
        all: async <Row>() => {
          if (boundValues.length === 0) {
            throw new Error("Membership query was not bound.");
          }
          return { results: memberships } as D1Result<Row>;
        },
        run: async () => ({ results: [], success: true }),
      };
      return statement;
    },
    batch: async () => [],
  } as unknown as D1Database;

  return {
    DB: database,
    APP_ENV: "development",
    DEV_AUTH_ENABLED: "true",
  };
}
