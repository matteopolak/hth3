export const DOMAIN_ROLES = [
  "applicant",
  "civic_staff",
  "hiring_reviewer",
  "organization_admin",
  "curator",
] as const;

export type DomainRole = (typeof DOMAIN_ROLES)[number];

export const ORGANIZATION_ACTIONS = [
  "application:read_organization",
  "application:review_organization",
  "posting:manage_organization",
  "feedback:read_organization",
  "feedback:respond_organization",
  "organization:manage_own",
] as const;

export const GLOBAL_ACTIONS = [
  "taxonomy:manage",
  "source:manage",
  "organization:manage_all",
] as const;

export const OWNER_ACTIONS = [
  "application:create_own",
  "application:read_own",
  "application:submit_own",
] as const;

export const DOMAIN_ACTIONS = [
  ...ORGANIZATION_ACTIONS,
  ...GLOBAL_ACTIONS,
  ...OWNER_ACTIONS,
] as const;

export type OrganizationAction = (typeof ORGANIZATION_ACTIONS)[number];
export type GlobalAction = (typeof GLOBAL_ACTIONS)[number];
export type OwnerAction = (typeof OWNER_ACTIONS)[number];
export type DomainAction = (typeof DOMAIN_ACTIONS)[number];

export const API_PERMISSIONS = [
  "read:applications",
  "write:applications",
  "submit:applications",
  "review:applications",
  "manage:postings",
  "read:feedback",
  "respond:feedback",
  "manage:taxonomy",
  "manage:sources",
  "manage:organizations",
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];

export interface AuthorizationActor {
  subject: string;
  roles: readonly DomainRole[];
  organizationId: string | null;
  permissions: readonly ApiPermission[];
}

const ROLE_PERMISSIONS: Record<DomainRole, readonly DomainAction[]> = {
  applicant: [
    "application:create_own",
    "application:read_own",
    "application:submit_own",
  ],
  civic_staff: ["feedback:read_organization", "feedback:respond_organization"],
  hiring_reviewer: [
    "application:read_organization",
    "application:review_organization",
  ],
  organization_admin: [
    "application:read_organization",
    "application:review_organization",
    "posting:manage_organization",
    "feedback:read_organization",
    "feedback:respond_organization",
    "organization:manage_own",
  ],
  curator: ["taxonomy:manage", "source:manage", "organization:manage_all"],
};

const ACTION_SCOPES: Record<DomainAction, ApiPermission> = {
  "application:create_own": "write:applications",
  "application:read_own": "read:applications",
  "application:submit_own": "submit:applications",
  "application:read_organization": "read:applications",
  "application:review_organization": "review:applications",
  "posting:manage_organization": "manage:postings",
  "feedback:read_organization": "read:feedback",
  "feedback:respond_organization": "respond:feedback",
  "organization:manage_own": "manage:organizations",
  "taxonomy:manage": "manage:taxonomy",
  "source:manage": "manage:sources",
  "organization:manage_all": "manage:organizations",
};

const AUTH0_ROLE_NAMES: Readonly<Record<string, DomainRole>> = {
  "CivicResolve Applicant": "applicant",
  "CivicResolve Civic Reviewer": "civic_staff",
  "CivicResolve Hiring Reviewer": "hiring_reviewer",
  "CivicResolve Organization Admin": "organization_admin",
  "CivicResolve Platform Curator": "curator",
};

export function mapAuth0RoleNames(value: unknown): DomainRole[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((name: unknown) => {
        if (typeof name !== "string") return [];
        const role = AUTH0_ROLE_NAMES[name];
        return role ? [role] : [];
      }),
    ),
  ];
}

export function mapAuth0Permissions(value: unknown): ApiPermission[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\s+/)
      : [];
  return [
    ...new Set(
      values.filter(
        (permission): permission is ApiPermission =>
          typeof permission === "string" &&
          (API_PERMISSIONS as readonly string[]).includes(permission),
      ),
    ),
  ];
}

export function permissionsForRoles(
  roles: readonly DomainRole[],
): ApiPermission[] {
  return [
    ...new Set(
      roles.flatMap((role) =>
        ROLE_PERMISSIONS[role].map((action) => ACTION_SCOPES[action]),
      ),
    ),
  ];
}

export function isDomainAction(value: unknown): value is DomainAction {
  return (
    typeof value === "string" &&
    (DOMAIN_ACTIONS as readonly string[]).includes(value)
  );
}

export function isGlobalAction(value: unknown): value is GlobalAction {
  return (
    typeof value === "string" &&
    (GLOBAL_ACTIONS as readonly string[]).includes(value)
  );
}

export function isOwnerAction(value: unknown): value is OwnerAction {
  return (
    typeof value === "string" &&
    (OWNER_ACTIONS as readonly string[]).includes(value)
  );
}

export function hasPermission(
  role: DomainRole,
  action: DomainAction,
  permissions: readonly ApiPermission[],
): boolean {
  return (
    ROLE_PERMISSIONS[role].includes(action) &&
    permissions.includes(ACTION_SCOPES[action])
  );
}

export function canPerformOrganizationAction(
  actor: AuthorizationActor,
  action: OrganizationAction,
  targetOrganizationId: string,
): boolean {
  return (
    targetOrganizationId.length > 0 &&
    actor.organizationId === targetOrganizationId &&
    actor.roles.some((role) => hasPermission(role, action, actor.permissions))
  );
}

export function canPerformGlobalAction(
  actor: AuthorizationActor,
  action: GlobalAction,
): boolean {
  return actor.roles.some((role) =>
    hasPermission(role, action, actor.permissions),
  );
}

export function canPerformOwnerAction(
  actor: AuthorizationActor,
  action: OwnerAction,
  ownerSubject: string,
): boolean {
  return (
    actor.subject === ownerSubject &&
    actor.roles.some((role) => hasPermission(role, action, actor.permissions))
  );
}
