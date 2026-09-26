import { describe, expect, it } from "vitest";
import { toConsultation, type ConsultationRow } from "./index.js";

function row(
  jurisdictionCode: ConsultationRow["jurisdiction_code"],
  deadlineDate: string | null,
  kind: ConsultationRow["kind"] = "consultation",
): ConsultationRow {
  return {
    id: "consultation-test",
    kind,
    title: "Consultation test",
    summary: "Test summary.",
    publisher: "Official publisher",
    jurisdiction_level: jurisdictionCode === "CA" ? "federal" : "provincial",
    jurisdiction_code: jurisdictionCode,
    jurisdiction_name:
      jurisdictionCode === "CA-BC"
        ? "British Columbia"
        : jurisdictionCode === "CA-ON"
          ? "Ontario"
          : "Canada",
    official_url: "https://example.gov/consultation",
    evidence_url: "https://example.gov/consultation",
    deadline_date: deadlineDate,
    verified_at: "2026-09-26T00:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    source_state: "current",
    last_error: null,
  };
}

describe("date-only consultation deadline status", () => {
  it("keeps a B.C. opportunity open until its local deadline date", () => {
    const beforeMidnight = new Date("2026-06-02T06:30:00.000Z");
    const deadlineDate = new Date("2026-06-02T08:00:00.000Z");

    expect(
      toConsultation(row("CA-BC", "2026-06-02"), beforeMidnight)
        .participationStatus,
    ).toBe("open");
    expect(
      toConsultation(row("CA-BC", "2026-06-02"), deadlineDate)
        .participationStatus,
    ).toBe("check_official_source");
  });

  it("marks an Ontario date closed only after the local calendar day ends", () => {
    const deadlineDay = new Date("2026-10-12T05:00:00.000Z");
    const nextLocalDay = new Date("2026-10-13T04:30:00.000Z");

    expect(
      toConsultation(row("CA-ON", "2026-10-12"), deadlineDay)
        .participationStatus,
    ).toBe("check_official_source");
    expect(
      toConsultation(row("CA-ON", "2026-10-12"), nextLocalDay)
        .participationStatus,
    ).toBe("closed");
  });

  it("keeps federal deadlines as publisher-check states on and after the date", () => {
    const deadlineDate = new Date("2026-10-11T08:00:00.000Z");
    const afterDate = new Date("2026-10-12T10:00:00.000Z");

    expect(
      toConsultation(row("CA", "2026-10-11"), deadlineDate).participationStatus,
    ).toBe("check_official_source");
    expect(
      toConsultation(row("CA", "2026-10-11"), afterDate).participationStatus,
    ).toBe("check_official_source");
  });

  it("does not infer a deadline for invalid dates or directories", () => {
    const now = new Date("2026-10-12T12:00:00.000Z");

    expect(
      toConsultation(row("CA-ON", "2026-02-30"), now).participationStatus,
    ).toBe("check_official_source");
    expect(
      toConsultation(row("CA-ON", null, "directory"), now).participationStatus,
    ).toBe("directory");
  });
});
