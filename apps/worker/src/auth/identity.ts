import {
  mapAuth0Permissions,
  mapAuth0RoleNames,
  permissionsForRoles,
  type AuthorizationActor,
  type ApiPermission,
  type DomainRole,
} from "@civicresolve/domain/permissions";
import type { D1Database } from "@civicresolve/db/d1";
import {
  AUTH0_ROLES_CLAIM,
  Auth0TokenError,
  verifyAuth0AccessToken,
  type Auth0Configuration,
  type Auth0Claims,
} from "./jwt.js";

export interface AuthEnvironment {
  DB: D1Database;
  APP_ENV: "development" | "production";
  DEV_AUTH_ENABLED?: string;
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
}

export interface AuthenticatedActor extends AuthorizationActor {
  authMethod: "auth0" | "development";
}

interface LocalPrincipal {
  subject: string;
  organizationAuth0Id: string | null;
  roles: readonly DomainRole[];
}

const LOCAL_PRINCIPALS: Readonly<Record<string, LocalPrincipal>> = {
  "dev-applicant": {
    subject: "local:applicant",
    organizationAuth0Id: null,
    roles: ["applicant"],
  },
  "dev-civic-staff": {
    subject: "local:civic-staff",
    organizationAuth0Id: "org_43G1B1RhPwac7EjS",
    roles: ["civic_staff"],
  },
  "dev-hiring-reviewer": {
    subject: "local:hiring-reviewer",
    organizationAuth0Id: "org_43G1B1RhPwac7EjS",
    roles: ["hiring_reviewer"],
  },
  "dev-organization-admin": {
    subject: "local:organization-admin",
    organizationAuth0Id: "org_43G1B1RhPwac7EjS",
    roles: ["organization_admin"],
  },
  "dev-curator": {
    subject: "local:curator",
    organizationAuth0Id: "org_43G1B1RhPwac7EjS",
    roles: ["curator"],
  },
  "dev-other-civic-staff": {
    subject: "local:other-civic-staff",
    organizationAuth0Id: "org_local_other",
    roles: ["civic_staff"],
  },
};

interface MembershipRow {
  organization_id: string;
  role: DomainRole;
}

export async function authenticateRequest(
  request: Request,
  environment: AuthEnvironment,
): Promise<AuthenticatedActor | null> {
  const token = bearerToken(request.headers.get("Authorization"));
  if (!token) return null;

  const localEnabled =
    environment.APP_ENV === "development" &&
    environment.DEV_AUTH_ENABLED === "true";
  const localPrincipal = localEnabled ? LOCAL_PRINCIPALS[token] : undefined;
  if (localPrincipal) {
    return actorFromPrincipal(
      environment.DB,
      localPrincipal.subject,
      localPrincipal.organizationAuth0Id,
      localPrincipal.roles,
      permissionsForRoles(localPrincipal.roles),
      "development",
    );
  }

  const configuration = auth0Configuration(environment);
  const claims = await verifyAuth0AccessToken(token, configuration);
  return actorFromClaims(environment.DB, claims);
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function auth0Configuration(environment: AuthEnvironment): Auth0Configuration {
  if (!environment.AUTH0_DOMAIN || !environment.AUTH0_AUDIENCE)
    throw new Auth0TokenError();
  return {
    domain: environment.AUTH0_DOMAIN,
    audience: environment.AUTH0_AUDIENCE,
  };
}

async function actorFromClaims(
  database: D1Database,
  claims: Auth0Claims,
): Promise<AuthenticatedActor> {
  const claimedRoles = mapAuth0RoleNames(claims[AUTH0_ROLES_CLAIM]);
  const claimedPermissions = mapAuth0Permissions(
    claims.permissions ?? claims.scope,
  );
  return actorFromPrincipal(
    database,
    claims.sub,
    claims.org_id ?? null,
    claimedRoles,
    claimedPermissions,
    "auth0",
  );
}

async function actorFromPrincipal(
  database: D1Database,
  subject: string,
  organizationAuth0Id: string | null,
  claimedRoles: readonly DomainRole[],
  claimedPermissions: readonly ApiPermission[],
  authMethod: AuthenticatedActor["authMethod"],
): Promise<AuthenticatedActor> {
  const applicantRole: DomainRole[] = claimedRoles.includes("applicant")
    ? ["applicant"]
    : [];
  const organizationRoles = claimedRoles.filter((role) => role !== "applicant");
  let organizationId: string | null = null;
  let memberRoles: DomainRole[] = [];

  if (organizationAuth0Id && organizationRoles.length > 0) {
    const placeholders = organizationRoles.map(() => "?").join(", ");
    const result = await database
      .prepare(
        `SELECT m.organization_id, m.role
         FROM organization_memberships AS m
         JOIN organizations AS o ON o.id = m.organization_id
         WHERE m.user_subject = ? AND o.auth0_org_id = ?
           AND m.role IN (${placeholders})`,
      )
      .bind(subject, organizationAuth0Id, ...organizationRoles)
      .all<MembershipRow>();

    const memberships = result.results ?? [];
    if (memberships.length > 0) {
      organizationId = memberships[0]!.organization_id;
      memberRoles = memberships
        .filter((membership) => membership.organization_id === organizationId)
        .map((membership) => membership.role);
    }
  }

  return {
    subject,
    organizationId,
    roles: [...new Set([...applicantRole, ...memberRoles])],
    permissions: permissionsForRoles([...applicantRole, ...memberRoles]).filter(
      (permission) => claimedPermissions.includes(permission),
    ),
    authMethod,
  };
}
