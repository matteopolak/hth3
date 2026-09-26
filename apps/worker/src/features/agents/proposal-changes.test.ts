import { describe, expect, it } from "vitest";
import { proposalChanges } from "./proposal-changes.js";

describe("proposal changes", () => {
  it("compares only submitted fields against the authorized record", () => {
    expect(
      proposalChanges(
        "edit_organization_posting",
        { id: "posting_1", title: "New title" },
        { title: "New title", location: undefined },
        { posting: { title: "Old title", location: "Ottawa" } },
      ),
    ).toEqual([{ field: "Title", before: "Old title", after: "New title" }]);
    expect(
      proposalChanges(
        "staff_change_feedback_status",
        { id: "fb_1", status: "in_review" },
        { status: "in_review", outcome: undefined },
        { submission: { status: "new", outcome: null } },
      ),
    ).toEqual([{ field: "Status", before: "new", after: "in_review" }]);
  });

  it("shows every field that a new record will send without treating approvals as record fields", () => {
    expect(
      proposalChanges(
        "create_feedback",
        { message: "A crossing light is broken", municipalityId: "3520005" },
        {
          message: "A crossing light is broken",
          municipalityId: "3520005",
          category: "road_safety",
          sandboxAcknowledged: false,
          duplicateOverride: false,
        },
        null,
      ),
    ).toEqual([
      { field: "Message", before: null, after: "A crossing light is broken" },
      { field: "Municipality Id", before: null, after: "3520005" },
      { field: "Category", before: null, after: "road_safety" },
    ]);
    expect(
      proposalChanges(
        "create_organization_posting",
        {},
        {
          title: "Planner",
          description: "Public service role",
          location: "Ottawa",
        },
        null,
      ),
    ).toHaveLength(3);
  });

  it("shows messages and specialized actions alongside existing record changes", () => {
    expect(
      proposalChanges(
        "staff_request_feedback_details",
        { id: "fb_1", message: "Which crossing?" },
        { message: "Which crossing?" },
        { submission: { status: "in_review" } },
      ),
    ).toEqual([
      { field: "Status", before: "in_review", after: "waiting_on_resident" },
      { field: "Message", before: null, after: "Which crossing?" },
    ]);
    expect(
      proposalChanges(
        "review_feedback_theme_membership",
        { id: "theme_1", submissionId: "fb_2" },
        { submissionId: "fb_2" },
        { sources: [{ id: "fb_1" }] },
      ),
    ).toEqual([{ field: "Submission in theme", before: false, after: true }]);
    expect(
      proposalChanges(
        "record_application_decision",
        { id: "app_1" },
        { status: "shortlisted", message: "Please schedule a call" },
        { application: { status: "submitted" } },
      ),
    ).toEqual([
      { field: "Status", before: "submitted", after: "shortlisted" },
      {
        field: "Applicant message",
        before: null,
        after: "Please schedule a call",
      },
    ]);
  });

  it("compares private reusable answers and résumé deletion only from owner reads", () => {
    expect(
      proposalChanges(
        "save_reusable_answer",
        { id: "answer_1" },
        { label: "Why", response: "Updated answer" },
        {
          answers: [{ id: "answer_1", label: "Why", response: "Prior answer" }],
        },
      ),
    ).toEqual([
      { field: "Response", before: "Prior answer", after: "Updated answer" },
    ]);
    expect(
      proposalChanges("delete_resume", { id: "resume_1" }, undefined, {
        resumes: [{ id: "resume_1", filename: "private.pdf" }],
      }),
    ).toEqual([
      {
        field: "Résumé",
        before: { id: "resume_1", filename: "private.pdf" },
        after: null,
      },
    ]);
  });

  it("previews saved workspace definitions and separate settings versions", () => {
    expect(
      proposalChanges(
        "edit_saved_view",
        { id: "view_1", expectedVersion: 2 },
        {
          name: "Urgent cases",
          days: 7,
          status: "in_review",
          category: "",
          expectedVersion: 2,
        },
        {
          view: {
            name: "Open cases",
            days: 30,
            status: "in_review",
            category: "",
            version: 2,
          },
        },
      ),
    ).toEqual([
      { field: "Name", before: "Open cases", after: "Urgent cases" },
      { field: "Days", before: 30, after: 7 },
    ]);
    expect(
      proposalChanges(
        "set_organization_reporting_window",
        { expectedVersion: 1 },
        { reportingWindowDays: 90, expectedVersion: 1 },
        {
          settings: {
            reportingWindowDays: 30,
            organizationVersion: 1,
            personalVersion: 5,
          },
        },
      ),
    ).toEqual([{ field: "Reporting window days", before: 30, after: 90 }]);
    expect(
      proposalChanges(
        "create_saved_report",
        {},
        { name: "Monthly counts", days: 30, groupBy: "category" },
        null,
      ),
    ).toHaveLength(3);
  });
});
