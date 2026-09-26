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
});
