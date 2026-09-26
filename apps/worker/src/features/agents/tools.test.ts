import { expect, it } from "vitest";
import { prepareTool, ToolInputError, visibleTools } from "./tools.js";

it("keeps new agent actions on fixed, role-scoped routes", () => {
  const org = "org_123";
  const resident = visibleTools("resident").map((tool) => tool.name);
  const employee = visibleTools("employee").map((tool) => tool.name);
  expect(resident).toContain("save_external_preparation");
  expect(resident).toContain("submit_program_application");
  expect(resident).not.toContain("staff_assign_feedback");
  expect(employee).toContain("staff_assign_feedback");
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
