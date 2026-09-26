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
  return update({
    status: "authenticated",
    accessToken,
    mode,
    displayName: user?.name ?? user?.email ?? null,
    organizationId,
    error: null,
  });
}

function errorSnapshot(error: unknown): WebAuthSnapshot {
  return update({
    status: "error",
    accessToken: null,
    mode: null,
    displayName: null,
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
