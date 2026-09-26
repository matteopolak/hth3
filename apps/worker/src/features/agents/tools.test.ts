import { expect, it } from "vitest";
import { prepareTool, ToolInputError, visibleTools } from "./tools.js";

it("keeps new agent actions on fixed, role-scoped routes", () => {
  const org = "org_123";
  const resident = visibleTools("resident").map((tool) => tool.name);
  const employee = visibleTools("employee").map((tool) => tool.name);
  expect(resident).toContain("save_external_preparation");
  expect(resident).toContain("submit_program_application");
  expect(resident).toContain("check_feedback_duplicate");
  expect(resident).not.toContain("staff_assign_feedback");
  expect(employee).toContain("staff_assign_feedback");
  expect(employee).toContain("theme_candidates");
  expect(resident).not.toContain("theme_candidates");
  expect(employee).not.toContain("save_external_preparation");

  expect(
    prepareTool(
      "search_discovery",
      { location: "Ottawa & nearby", type: "service_location" },
      "resident",
      null,
    ).path,
  ).toBe("/api/v1/discovery?type=service_location&location=Ottawa+%26+nearby");
  const program = prepareTool(
    "submit_program_application",
    { programId: "prg_123", answers: { need: "I need help" } },
    "resident",
    null,
  );
  expect(program.body).toMatchObject({ sandboxAcknowledged: false });
  const assignment = prepareTool(
    "staff_assign_feedback",
    {
      id: `fb_${"a".repeat(32)}`,
      departmentId: "dept_123",
      assigneeSubject: null,
    },
    "employee",
    org,
  );
  expect(assignment.path).toBe(
    `/api/v1/staff/organizations/${org}/feedback/fb_${"a".repeat(32)}/assignment`,
  );
  const duplicateCheck = prepareTool(
    "check_feedback_duplicate",
    {
      message: "The streetlight outside the library is broken.",
      municipalityId: "3520005",
      category: "public_space",
    },
    "resident",
    null,
  );
  expect(duplicateCheck.path).toBe("/api/v1/feedback/duplicate-check");
  expect(duplicateCheck.tool.access).toBe("read");
  const candidates = prepareTool("theme_candidates", {}, "employee", org);
  expect(candidates.path).toBe(
    `/api/v1/staff/organizations/${org}/themes/candidates`,
  );
  expect(candidates.tool.method).toBe("POST");
  expect(candidates.tool.access).toBe("read");
  const feedback = prepareTool(
    "create_feedback",
    {
      message: "The streetlight outside the library is broken.",
      municipalityId: "3520005",
      duplicateOverride: true,
    },
    "resident",
    null,
  );
  expect(feedback.body).toMatchObject({ duplicateOverride: false });
  expect(() =>
    prepareTool("staff_assign_feedback", {}, "resident", null),
  ).toThrow(ToolInputError);
  expect(() =>
    prepareTool(
      "read_external_preparation",
      { id: "https://attacker.invalid" },
      "resident",
      null,
    ),
  ).toThrow(ToolInputError);
});
