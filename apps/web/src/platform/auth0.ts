import { Auth0Client, type User } from "@auth0/auth0-spa-js";

export type WebAuthMode = "applicant" | "employee";
export type WebAuthStatus =
  | "loading"
  | "guest"
  | "authenticated"
  | "error"
  | "unconfigured";

export interface WebAuthSnapshot {
  status: WebAuthStatus;
  accessToken: string | null;
  mode: WebAuthMode | null;
  displayName: string | null;
  email: string | null;
  pictureUrl: string | null;
  organizationId: string | null;
  error: string | null;
}

interface LoginState {
  mode?: WebAuthMode;
}

const domain =
  import.meta.env.VITE_AUTH0_DOMAIN ?? "dev-ole6i03kzvf3yb8z.us.auth0.com";
const clientId =
  import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ??
  "pZ0Uiv6Vgo47xte582Yx5YUzwjvVt1tK";
const audience =
  import.meta.env.VITE_AUTH0_AUDIENCE ?? "https://civicresolve.example/api";
const staffOrganizationId =
  import.meta.env.VITE_AUTH0_STAFF_ORGANIZATION_ID ?? "org_43G1B1RhPwac7EjS";
const scope = "openid profile email";

let client: Auth0Client | null = null;
let pendingInitialization: Promise<WebAuthSnapshot> | null = null;
let current: WebAuthSnapshot = {
  status: clientId ? "loading" : "unconfigured",
  accessToken: null,
  mode: null,
  displayName: null,
  email: null,
  pictureUrl: null,
  organizationId: null,
  error: null,
};
const listeners = new Set<(snapshot: WebAuthSnapshot) => void>();

function update(snapshot: WebAuthSnapshot): WebAuthSnapshot {
  current = snapshot;
  for (const listener of listeners) listener(snapshot);
  return snapshot;
}

function getClient(): Auth0Client {
  if (!clientId) throw new Error("Auth0 web client ID is not configured.");
  client ??= new Auth0Client({
    domain,
    clientId,
    cacheLocation: "memory",
    useRefreshTokens: false,
    authorizationParams: {
      audience,
      scope,
      redirect_uri: `${window.location.origin}/callback`,
    },
  });
  return client;
}

function callbackPending(): boolean {
  const query = new URLSearchParams(window.location.search);
  return (
    window.location.pathname === "/callback" &&
    (query.has("code") || query.has("error")) &&
    query.has("state")
  );
}

async function loadAuthenticatedSession(
  auth0: Auth0Client,
  requestedMode?: WebAuthMode,
): Promise<WebAuthSnapshot> {
  const claims = await auth0.getIdTokenClaims();
  const organizationId =
    typeof claims?.org_id === "string" ? claims.org_id : null;
  const mode = requestedMode ?? (organizationId ? "employee" : "applicant");
  if (mode === "employee" && organizationId !== staffOrganizationId) {
    throw new Error("This account is not signed in to the staff organization.");
  }
  const accessToken = await auth0.getTokenSilently({
    authorizationParams: {
      audience,
      scope,
      ...(mode === "employee" ? { organization: staffOrganizationId } : {}),
    },
  });
  if (!accessToken) throw new Error("Auth0 did not issue an access token.");
  const user: User | undefined = await auth0.getUser();
  const identity = accountIdentity(user, claims);
  return update({
    status: "authenticated",
    accessToken,
    mode,
    ...identity,
    organizationId,
    error: null,
  });
}

type ProfileFields = {
  email?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  name?: unknown;
  nickname?: unknown;
  preferred_username?: unknown;
  picture?: unknown;
};

/** Derives a short public label while retaining the full email for accessibility. */
export function accountIdentity(
  user: ProfileFields | undefined,
  claims: ProfileFields | undefined,
): Pick<WebAuthSnapshot, "displayName" | "email" | "pictureUrl"> {
  const email = profileText(user?.email) ?? profileText(claims?.email);
  const fullName = [
    profileText(user?.given_name) ?? profileText(claims?.given_name),
    profileText(user?.family_name) ?? profileText(claims?.family_name),
  ]
    .filter(Boolean)
    .join(" ");
  const suppliedName = [
    fullName,
    user?.name,
    claims?.name,
    user?.nickname,
    claims?.nickname,
    user?.preferred_username,
  ]
    .map(humanName)
    .find(Boolean);
  const derivedName = [
    user?.nickname,
    claims?.nickname,
    user?.preferred_username,
    email,
  ]
    .map(identifierName)
    .find(Boolean);
  return {
    displayName: suppliedName ?? derivedName ?? compactEmailLabel(email),
    email,
    pictureUrl:
      safePictureUrl(user?.picture) ?? safePictureUrl(claims?.picture),
  };
}

function humanName(value: unknown): string | null {
  const name = profileText(value);
  if (!name || !/^[\p{L}][\p{L} '’\-]*$/u.test(name)) return null;
  return name.replace(
    /(^|[ '’\-])(\p{L})/gu,
    (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase(),
  );
}

function identifierName(value: unknown): string | null {
  const raw = profileText(value);
  if (!raw) return null;
  const local = raw.split("@")[0]!;
  const segments = local.split(/[._-]+/);
  if (
    segments.length < 2 ||
    segments.some((part) => !/^\p{L}{2,}$/u.test(part) && !/^\d+$/u.test(part))
  )
    return null;
  const words = segments.filter((part) => /^\p{L}{2,}$/u.test(part));
  if (words.length < 2) return null;
  return words
    .slice(0, 3)
    .map((word) => word[0]!.toLocaleUpperCase() + word.slice(1))
    .join(" ");
}

function profileText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactEmailLabel(email: string | null): string | null {
  if (!email || email.length <= 29) return email;
  const at = email.lastIndexOf("@");
  if (at < 1) return `${email.slice(0, 28)}…`;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const shortDomain = domain.length > 17 ? `${domain.slice(0, 14)}…` : domain;
  const localLimit = Math.max(5, 28 - shortDomain.length - 2);
  const shortLocal =
    local.length > localLimit ? `${local.slice(0, localLimit)}…` : local;
  return `${shortLocal}@${shortDomain}`;
}

function safePictureUrl(value: unknown): string | null {
  const picture = profileText(value);
  if (!picture) return null;
  try {
    const url = new URL(picture);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function errorSnapshot(error: unknown): WebAuthSnapshot {
  return update({
    status: "error",
    accessToken: null,
    mode: null,
    displayName: null,
    email: null,
    pictureUrl: null,
    organizationId: null,
    error: error instanceof Error ? error.message : "Sign-in is unavailable.",
  });
}

export const webAuth = {
  snapshot: (): WebAuthSnapshot => current,

  subscribe(listener: (snapshot: WebAuthSnapshot) => void): () => void {
    listeners.add(listener);
    listener(current);
    return () => listeners.delete(listener);
  },

  initialize(): Promise<WebAuthSnapshot> {
    if (pendingInitialization) return pendingInitialization;
    if (!clientId) return Promise.resolve(current);
    pendingInitialization = (async () => {
      try {
        const auth0 = getClient();
        if (callbackPending()) {
          const { appState } = await auth0.handleRedirectCallback<LoginState>();
          window.history.replaceState({}, "", "/");
          return loadAuthenticatedSession(auth0, appState?.mode);
        }
        if (window.location.pathname === "/callback") {
          window.history.replaceState({}, "", "/");
        }
        await auth0.checkSession();
        if (await auth0.isAuthenticated())
          return loadAuthenticatedSession(auth0);
        return update({
          status: "guest",
          accessToken: null,
          mode: null,
          displayName: null,
          email: null,
          pictureUrl: null,
          organizationId: null,
          error: null,
        });
      } catch (error) {
        return errorSnapshot(error);
      }
    })();
    return pendingInitialization;
  },

  async login(mode: WebAuthMode): Promise<void> {
    const auth0 = getClient();
    await auth0.loginWithRedirect({
      appState: { mode } satisfies LoginState,
      authorizationParams: {
        audience,
        scope,
        redirect_uri: `${window.location.origin}/callback`,
        ...(mode === "employee" ? { organization: staffOrganizationId } : {}),
      },
    });
  },

  async logout(): Promise<void> {
    if (!client) return;
    update({
      status: "guest",
      accessToken: null,
      mode: null,
      displayName: null,
      email: null,
      pictureUrl: null,
      organizationId: null,
      error: null,
    });
    await client.logout({
      logoutParams: { returnTo: window.location.origin },
    });
  },

  async getAccessToken(): Promise<string | null> {
    if (current.status !== "authenticated" || !client) return null;
    try {
      const accessToken = await client.getTokenSilently({
        authorizationParams: {
          audience,
          scope,
          ...(current.mode === "employee"
            ? { organization: staffOrganizationId }
            : {}),
        },
      });
      if (!accessToken) throw new Error("Auth0 did not issue an access token.");
      if (accessToken !== current.accessToken)
        update({ ...current, accessToken });
      return accessToken;
    } catch (error) {
      errorSnapshot(error);
      return null;
    }
  },
};
