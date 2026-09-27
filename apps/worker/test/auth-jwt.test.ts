import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  Auth0JwksClient,
  Auth0TokenError,
  verifyAuth0Token,
} from "../src/auth/jwt.js";

const DOMAIN = "https://auth.example.test";
const AUDIENCE = "https://civicresolve.example/api";
const NOW = 1_900_000_000;
const KEY_ID = "test-signing-key";

let signingKey: CryptoKey;
let jwk: JsonWebKey & { kid: string; alg: string; use: string };

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  signingKey = pair.privateKey;
  jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey & {
    kid: string;
    alg: string;
    use: string;
  };
  Object.assign(jwk, { kid: KEY_ID, alg: "RS256", use: "sig" });
});

describe("Auth0 access token verification", () => {
  it("verifies RS256, issuer, audience, expiry, and signed claims", async () => {
    const token = await signToken({
      iss: `${DOMAIN}/`,
      aud: AUDIENCE,
      sub: "auth0|demo",
      org_id: "org_43G1B1RhPwac7EjS",
      exp: NOW + 3600,
      nbf: NOW - 10,
      permissions: ["read:applications", "review:applications"],
      ["https://civicresolve.example/roles"]: [
        "CivicResolve Organization Admin",
      ],
    });
    const claims = await verifyAuth0Token(
      token,
      { domain: DOMAIN, audience: AUDIENCE },
      testJwks(),
      NOW,
    );

    expect(claims.sub).toBe("auth0|demo");
    expect(claims.org_id).toBe("org_43G1B1RhPwac7EjS");
    expect(claims.permissions).toEqual([
      "read:applications",
      "review:applications",
    ]);
    expect(claims["https://civicresolve.example/roles"]).toEqual([
      "CivicResolve Organization Admin",
    ]);
  });

  it.each([
    ["wrong issuer", { iss: "https://other.example/" }],
    ["wrong audience", { aud: "https://other.example/api" }],
    ["expired token", { exp: NOW - 120 }],
    ["not-yet-valid token", { nbf: NOW + 120 }],
  ])("rejects a token with %s", async (_caseName, overrides) => {
    const token = await signToken({
      iss: `${DOMAIN}/`,
      aud: AUDIENCE,
      sub: "auth0|demo",
      exp: NOW + 3600,
      ...overrides,
    });
    await expect(
      verifyAuth0Token(
        token,
        { domain: DOMAIN, audience: AUDIENCE },
        testJwks(),
        NOW,
      ),
    ).rejects.toBeInstanceOf(Auth0TokenError);
  });

  it("rejects an unsupported algorithm and a modified signature", async () => {
    const claims = {
      iss: `${DOMAIN}/`,
      aud: AUDIENCE,
      sub: "auth0|demo",
      exp: NOW + 3600,
    };
    const wrongAlgorithm = await signToken(claims, "HS256");
    await expect(
      verifyAuth0Token(
        wrongAlgorithm,
        { domain: DOMAIN, audience: AUDIENCE },
        testJwks(),
        NOW,
      ),
    ).rejects.toBeInstanceOf(Auth0TokenError);

    const valid = await signToken(claims);
    const [header, payload, signature] = valid.split(".");
    const changedSignature = `${signature!.startsWith("A") ? "B" : "A"}${signature!.slice(1)}`;
    const modified = `${header}.${payload}.${changedSignature}`;
    await expect(
      verifyAuth0Token(
        modified,
        { domain: DOMAIN, audience: AUDIENCE },
        testJwks(),
        NOW,
      ),
    ).rejects.toBeInstanceOf(Auth0TokenError);
  });
});

function testJwks(): Auth0JwksClient {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "Cache-Control": "max-age=300" },
      }),
  );
  return new Auth0JwksClient(fetcher as typeof fetch);
}

async function signToken(
  claims: Record<string, unknown>,
  algorithm = "RS256",
): Promise<string> {
  const header = { alg: algorithm, kid: KEY_ID, typ: "JWT" };
  const signingInput = `${encode(JSON.stringify(header))}.${encode(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${encode(new Uint8Array(signature))}`;
}

function encode(value: string | Uint8Array): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
