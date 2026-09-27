export const AUTH0_ROLES_CLAIM = "https://civicresolve.example/roles";

export interface Auth0Configuration {
  domain: string;
  audience: string;
}

export interface Auth0Claims {
  sub: string;
  org_id?: string;
  permissions?: unknown;
  scope?: unknown;
  [AUTH0_ROLES_CLAIM]?: unknown;
}

interface JwtHeader {
  alg?: unknown;
  kid?: unknown;
  crit?: unknown;
}

interface JwtPayload {
  sub?: unknown;
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  org_id?: unknown;
  permissions?: unknown;
  scope?: unknown;
  [AUTH0_ROLES_CLAIM]?: unknown;
}

interface Auth0Jwk extends JsonWebKey {
  kid?: string;
  use?: string;
  alg?: string;
}

interface JwksDocument {
  keys?: Auth0Jwk[];
}

interface CachedJwks {
  keys: Auth0Jwk[];
  expiresAt: number;
}

const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 16_384;

export class Auth0TokenError extends Error {
  constructor(message = "The access token is invalid.") {
    super(message);
    this.name = "Auth0TokenError";
  }
}

export class Auth0JwksUnavailableError extends Error {
  constructor(
    readonly source: "network" | "http",
    readonly status?: number,
  ) {
    super("The identity signing keys are temporarily unavailable.");
    this.name = "Auth0JwksUnavailableError";
  }
}

export class Auth0JwksClient {
  private readonly cache = new Map<string, CachedJwks>();

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async getSigningKey(domain: string, kid: string): Promise<Auth0Jwk> {
    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      const key = cached.keys.find((candidate) => candidate.kid === kid);
      if (key) return key;
      throw new Auth0TokenError();
    }

    let response: Response;
    try {
      response = await this.fetcher(`${domain}/.well-known/jwks.json`, {
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new Auth0JwksUnavailableError("network");
    }
    if (!response.ok)
      throw new Auth0JwksUnavailableError("http", response.status);

    const document = (await response
      .json()
      .catch(() => null)) as JwksDocument | null;
    if (!document || !Array.isArray(document.keys)) throw new Auth0TokenError();

    const keys = document.keys.filter(
      (key) =>
        key.kty === "RSA" &&
        (key.use === undefined || key.use === "sig") &&
        (key.alg === undefined || key.alg === "RS256"),
    );
    if (keys.length === 0) throw new Auth0TokenError();

    const maxAge = response.headers
      .get("Cache-Control")
      ?.match(/(?:^|,)\s*max-age=(\d+)/i);
    const cacheSeconds = maxAge
      ? Math.min(3600, Math.max(60, Number(maxAge[1])))
      : 300;
    this.cache.set(domain, {
      keys,
      expiresAt: Date.now() + cacheSeconds * 1000,
    });

    const key = keys.find((candidate) => candidate.kid === kid);
    if (!key) throw new Auth0TokenError();
    return key;
  }
}

const jwksClients = new Map<string, Auth0JwksClient>();

export async function verifyAuth0AccessToken(
  token: string,
  configuration: Auth0Configuration,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Auth0Claims> {
  const normalizedDomain = auth0Origin(configuration.domain);
  let client = jwksClients.get(normalizedDomain);
  if (!client) {
    client = new Auth0JwksClient();
    jwksClients.set(normalizedDomain, client);
  }
  return verifyAuth0Token(token, configuration, client, nowSeconds);
}

export async function verifyAuth0Token(
  token: string,
  configuration: Auth0Configuration,
  jwks: Auth0JwksClient,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Auth0Claims> {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH)
    throw new Auth0TokenError();

  const segments = token.split(".");
  if (segments.length !== 3) throw new Auth0TokenError();
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  if (!encodedHeader || !encodedPayload || !encodedSignature)
    throw new Auth0TokenError();

  const header = parseSegment<JwtHeader>(encodedHeader);
  const payload = parseSegment<JwtPayload>(encodedPayload);
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.kid.length === 0 ||
    header.crit !== undefined
  ) {
    throw new Auth0TokenError();
  }

  const origin = auth0Origin(configuration.domain);
  if (payload.iss !== `${origin}/`) throw new Auth0TokenError();
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(configuration.audience)) throw new Auth0TokenError();
  if (
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= nowSeconds - CLOCK_SKEW_SECONDS
  ) {
    throw new Auth0TokenError();
  }
  if (
    (payload.nbf !== undefined &&
      (typeof payload.nbf !== "number" ||
        !Number.isFinite(payload.nbf) ||
        payload.nbf > nowSeconds + CLOCK_SKEW_SECONDS)) ||
    (payload.iat !== undefined &&
      (typeof payload.iat !== "number" ||
        !Number.isFinite(payload.iat) ||
        payload.iat > nowSeconds + CLOCK_SKEW_SECONDS))
  ) {
    throw new Auth0TokenError();
  }

  const jwk = await jwks.getSigningKey(origin, header.kid);
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new Auth0TokenError();
  }

  const signedContent = `${encodedHeader}.${encodedPayload}`;
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(signedContent),
  );
  if (!valid) throw new Auth0TokenError();

  const claims: Auth0Claims = { sub: payload.sub };
  if (typeof payload.org_id === "string") claims.org_id = payload.org_id;
  if ("permissions" in payload) claims.permissions = payload.permissions;
  if ("scope" in payload) claims.scope = payload.scope;
  if (AUTH0_ROLES_CLAIM in payload) {
    claims[AUTH0_ROLES_CLAIM] = payload[AUTH0_ROLES_CLAIM];
  }
  return claims;
}

function auth0Origin(domain: string): string {
  let url: URL;
  try {
    url = new URL(domain.includes("://") ? domain : `https://${domain}`);
  } catch {
    throw new Auth0TokenError();
  }
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Auth0TokenError();
  return url.origin;
}

function parseSegment<T>(value: string): T {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      decodeBase64Url(value),
    );
    return JSON.parse(decoded) as T;
  } catch {
    throw new Auth0TokenError();
  }
}

function decodeBase64Url(value: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Auth0TokenError();
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
    .buffer as ArrayBuffer;
}
