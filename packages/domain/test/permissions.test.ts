import { describe, expect, it } from "vitest";
import {
  canPerformOrganizationAction,
  canPerformOwnerAction,
  mapAuth0Permissions,
  mapAuth0RoleNames,
} from "../src/permissions/index.js";

describe("CivicResolve role permissions", () => {
  it("maps only the exact namespaced Auth0 role display names", () => {
    expect(
      mapAuth0RoleNames([
        "CivicResolve Applicant",
        "CivicResolve Organization Admin",
        "Organization Admin",
        "Unknown Role",
      ]),
    ).toEqual(["applicant", "organization_admin"]);
    expect(mapAuth0RoleNames("CivicResolve Platform Curator")).toEqual([]);
    expect(
      mapAuth0Permissions(["read:applications", "delete:everything", 4]),
    ).toEqual(["read:applications"]);
    expect(
      mapAuth0Permissions("read:feedback respond:feedback unsupported"),
    ).toEqual(["read:feedback", "respond:feedback"]);
  });

  it("requires the active organization and role for staff actions", () => {
    const civicStaff = {
      subject: "auth0|staff",
      roles: ["civic_staff"] as const,
      organizationId: "org_toronto_sandbox",
      permissions: ["read:feedback", "respond:feedback"] as const,
    };

    expect(
      canPerformOrganizationAction(
        civicStaff,
        "feedback:respond_organization",
        "org_toronto_sandbox",
      ),
    ).toBe(true);
    expect(
      canPerformOrganizationAction(
        civicStaff,
        "feedback:respond_organization",
        "org_other",
      ),
    ).toBe(false);
    expect(
      canPerformOrganizationAction(
        civicStaff,
        "application:review_organization",
        "org_toronto_sandbox",
      ),
    ).toBe(false);
  });

  it("scopes applicant actions to the authenticated subject without an org", () => {
    const applicant = {
      subject: "auth0|applicant",
      roles: ["applicant"] as const,
      organizationId: null,
      permissions: [
        "read:applications",
        "write:applications",
        "submit:applications",
      ] as const,
    };

    expect(
      canPerformOwnerAction(
        applicant,
        "application:create_own",
        applicant.subject,
      ),
    ).toBe(true);
    expect(
      canPerformOwnerAction(applicant, "application:read_own", "auth0|other"),
    ).toBe(false);
    expect(
      canPerformOrganizationAction(
        applicant,
        "application:review_organization",
        "org_toronto_sandbox",
      ),
    ).toBe(false);
  });

  it("requires the token grant as well as a matching role", () => {
    const applicantWithoutSubmitGrant = {
      subject: "auth0|applicant",
      roles: ["applicant"] as const,
      organizationId: null,
      permissions: ["read:applications", "write:applications"] as const,
    };

    expect(
      canPerformOwnerAction(
        applicantWithoutSubmitGrant,
        "application:submit_own",
        applicantWithoutSubmitGrant.subject,
      ),
    ).toBe(false);
  });
});
