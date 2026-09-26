import { expect, it } from "vitest";
import { executeTool, prepareTool, ToolInputError, visibleTools } from "./tools.js";

it("keeps new agent actions on fixed, role-scoped routes", async () => {
  const org = "org_123";
  const resident = visibleTools("resident").map((tool) => tool.name);
  const employee = visibleTools("employee").map((tool) => tool.name);
  expect(resident).toContain("save_external_preparation");
  expect(resident).toContain("submit_program_application");
  expect(resident).toContain("check_feedback_duplicate");
  expect(resident).toContain("prepare_feedback_evidence_upload");
  expect(resident).toContain("search_nearby");
  expect(resident).toContain("get_consultation_handoff");
  expect(resident).not.toContain("staff_assign_feedback");
  expect(employee).toContain("staff_assign_feedback");
  expect(employee).toContain("theme_candidates");
  expect(employee).toContain("search_nearby");
  expect(employee).toContain("list_consultations");
  expect(employee).toContain("read_staff_workspace");
  expect(employee).toContain("create_saved_view");
  expect(employee).toContain("run_saved_report");
  expect(employee).toContain("set_organization_reporting_window");
  expect(resident).not.toContain("theme_candidates");
  expect(resident).not.toContain("read_staff_workspace");
  expect(resident).not.toContain("read_staff_settings");
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
  const workspace = prepareTool("read_staff_workspace", {}, "employee", org);
  expect(workspace.path).toBe(`/api/v1/staff/organizations/${org}/workspace`);
  expect(workspace.tool.access).toBe("read");
  const view = prepareTool(
    "edit_saved_view",
    {
      id: "view_1",
      name: "Open cases",
      days: 30,
      status: "in_review",
      expectedVersion: 2,
    },
    "employee",
    org,
  );
  expect(view.path).toBe(
    `/api/v1/staff/organizations/${org}/workspace/views/view_1`,
  );
  expect(view.body).toMatchObject({
    name: "Open cases",
    days: 30,
    expectedVersion: 2,
  });
  expect(
    prepareTool("run_saved_report", { id: "report_1" }, "employee", org).path,
  ).toBe(
    `/api/v1/staff/organizations/${org}/workspace/reports/report_1/result`,
  );
  expect(
    prepareTool(
      "set_organization_reporting_window",
      { reportingWindowDays: 90, expectedVersion: 1 },
      "employee",
      org,
    ).body,
  ).toEqual({ reportingWindowDays: 90, expectedVersion: 1 });
  expect(() =>
    prepareTool("delete_saved_view", { id: "view_1" }, "employee", org),
  ).toThrow(ToolInputError);
  expect(() =>
    prepareTool(
      "create_saved_report",
      { name: "Counts", days: 30, groupBy: "invalid" },
      "employee",
      org,
    ),
  ).toThrow(ToolInputError);
  expect(() =>
    prepareTool(
      "create_saved_view",
      { name: "Cases", days: 30, status: "wrong" },
      "employee",
      org,
    ),
  ).toThrow(ToolInputError);
  expect(() =>
    prepareTool(
      "set_staff_default_view",
      { defaultView: "admin", expectedVersion: 0 },
      "employee",
      org,
    ),
  ).toThrow(ToolInputError);
  expect(
    prepareTool(
      "search_nearby",
      { category: "library", location: "Toronto", limit: 30 },
      "resident",
      null,
    ).path,
  ).toBe("/api/v1/nearby?category=library&location=Toronto&limit=30");
  expect(
    prepareTool(
      "list_consultations",
      { jurisdiction: "CA-ON" },
      "resident",
      null,
    ).path,
  ).toBe("/api/v1/consultations?jurisdiction=CA-ON");
  expect(
    prepareTool(
      "get_consultation_handoff",
      { id: "ontario-budget-2026" },
      "employee",
      org,
    ).path,
  ).toBe("/api/v1/consultations/ontario-budget-2026/handoff");
  expect(() =>
    prepareTool(
      "read_consultation",
      { id: "https://attacker.invalid" },
      "resident",
      null,
    ),
  ).toThrow(ToolInputError);
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
  const evidenceUpload = prepareTool(
    "prepare_feedback_evidence_upload",
    {},
    "resident",
    null,
    `conv_${"a".repeat(32)}`,
  );
  expect(evidenceUpload.path).toBe(
    `/api/v1/agent/conversations/conv_${"a".repeat(32)}/feedback-evidence`,
  );
  expect(evidenceUpload.tool.access).toBe("read");
  expect(() =>
    prepareTool("prepare_feedback_evidence_upload", {}, "resident", null),
  ).toThrow(ToolInputError);
  expect(await executeTool(
    new Request("http://localhost"),
    null!,
    evidenceUpload,
  )).toMatchObject({
    status: 200,
    data: { upload: { field: "file", requiresFileChooser: true, submitted: false } },
  });
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
