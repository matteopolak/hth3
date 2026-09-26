import type { ToolArguments } from "./types.js";

export interface ProposalChange {
  field: string;
  before: unknown;
  after: unknown;
}

type RecordValue = Record<string, unknown>;

const CREATION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  create_feedback: [
    "message",
    "municipalityId",
    "whatWouldImprove",
    "category",
  ],
  submit_application: ["postingId", "answers"],
  submit_program_application: ["programId", "answers"],
  create_organization_posting: ["title", "description", "location"],
  create_organization_program: ["kind", "title", "summary", "questions"],
  create_saved_view: ["name", "days", "status", "category"],
  create_saved_report: ["name", "days", "groupBy"],
};

const MESSAGE_TOOLS = new Set([
  "reply_feedback",
  "reopen_feedback",
  "staff_reply_feedback",
  "staff_request_feedback_details",
  "send_application_message",
  "send_staff_application_message",
  "send_program_application_message",
  "send_staff_program_application_message",
]);

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function label(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (first) => first.toUpperCase());
}

function addChange(
  changes: ProposalChange[],
  field: string,
  before: unknown,
  after: unknown,
): void {
  if (after === undefined || JSON.stringify(before) === JSON.stringify(after))
    return;
  changes.push({ field, before: before ?? null, after });
}

function addFields(
  changes: ProposalChange[],
  before: RecordValue | null,
  after: RecordValue | null,
  prefix = "",
): void {
  if (!after) return;
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    addChange(changes, `${prefix}${label(key)}`, before?.[key], value);
  }
}

/** Compare only fields the typed write will send against an authorized read. */
export function proposalChanges(
  name: string,
  args: ToolArguments,
  proposedBody: unknown,
  readData: unknown,
): ProposalChange[] {
  const data = record(readData);
  const body = record(proposedBody);
  const changes: ProposalChange[] = [];
  const creationFields = CREATION_FIELDS[name];
  if (creationFields && body) {
    for (const key of creationFields)
      addChange(changes, label(key), null, body[key]);
    return changes;
  }
  if (!data) return changes;
  if (name === "update_profile") {
    addFields(
      changes,
      record(data.profile),
      record(body?.profile),
      "Profile · ",
    );
  } else if (name === "save_external_preparation") {
    addFields(changes, record(data.preparation), body);
  } else if (name === "save_discovery_item") {
    const saved = Array.isArray(data.items)
      ? data.items.find(
          (entry) =>
            record(entry)?.item && record(record(entry)?.item)?.id === args.id,
        )
      : null;
    addFields(changes, record(saved), body);
    if (!saved) addChange(changes, "Saved", false, true);
  } else if (name === "remove_saved_discovery_item") {
    addChange(changes, "Saved", true, false);
  } else if (name === "delete_external_preparation") {
    addChange(changes, "Saved preparation", data.saved === true, false);
  } else if (name === "delete_profile") {
    addChange(changes, "Profile", data.profile, null);
  } else if (name === "save_reusable_answer") {
    const answer = Array.isArray(data.answers)
      ? data.answers.find((entry) => record(entry)?.id === args.id)
      : null;
    addFields(changes, record(answer), body);
  } else if (name === "delete_reusable_answer") {
    const answer = Array.isArray(data.answers)
      ? data.answers.find((entry) => record(entry)?.id === args.id)
      : null;
    if (answer) addChange(changes, "Reusable answer", answer, null);
  } else if (name === "delete_resume") {
    const resume = Array.isArray(data.resumes)
      ? data.resumes.find((entry) => record(entry)?.id === args.id)
      : null;
    if (resume) addChange(changes, "Résumé", resume, null);
  } else if (name === "edit_saved_view" || name === "edit_saved_report") {
    const current = record(
      name === "edit_saved_view" ? data.view : data.report,
    );
    const fields = body ? { ...body } : null;
    if (fields) delete fields.expectedVersion;
    addFields(changes, current, fields);
  } else if (name === "delete_saved_view" || name === "delete_saved_report") {
    const current = name === "delete_saved_view" ? data.view : data.report;
    if (current)
      addChange(
        changes,
        name === "delete_saved_view" ? "Saved view" : "Saved report",
        current,
        null,
      );
  } else if (name === "set_staff_default_view") {
    addChange(
      changes,
      "Default view",
      record(data.settings)?.defaultView,
      body?.defaultView,
    );
  } else if (name === "set_organization_reporting_window") {
    addChange(
      changes,
      "Reporting window days",
      record(data.settings)?.reportingWindowDays,
      body?.reportingWindowDays,
    );
  } else if (name === "propose_source_correction") {
    addFields(
      changes,
      record(data.source),
      record(body?.changes),
      "Proposed metadata · ",
    );
    addChange(changes, "Review status", null, "pending");
  } else if (name === "decide_source_correction") {
    const change = record(data.change);
    const decision = body?.decision;
    addChange(
      changes,
      "Review status",
      change?.status,
      decision === "approve" ? "approved" : "rejected",
    );
    addChange(changes, "Review reason", null, body?.reason);
    if (decision === "approve") {
      const source = record(data.source);
      const proposed = record(change?.proposed);
      if (source && proposed) {
        addFields(changes, source, proposed, "Source metadata · ");
        if (
          [
            "publisher",
            "sourceUrl",
            "licenceName",
            "licenceUrl",
            "termsUrl",
          ].some((field) => Object.hasOwn(proposed, field))
        )
          addChange(changes, "Terms status", source.termsStatus, "unreviewed");
        if (Object.hasOwn(proposed, "sourceUrl")) {
          addChange(
            changes,
            "Freshness state",
            source.freshnessState,
            "unknown",
          );
          for (const field of [
            "fetchedAt",
            "verifiedAt",
            "expiresAt",
            "lastError",
          ])
            addChange(changes, label(field), source[field], null);
        }
      }
    }
  } else if (
    name === "edit_organization_posting" ||
    name === "edit_organization_program"
  ) {
    addFields(changes, record(data.posting ?? data.program), body);
  } else if (
    name === "publish_organization_posting" ||
    name === "publish_organization_program"
  ) {
    addChange(
      changes,
      "Status",
      record(data.posting ?? data.program)?.status,
      "published",
    );
  } else if (
    name === "close_organization_posting" ||
    name === "close_organization_program"
  ) {
    addChange(
      changes,
      "Status",
      record(data.posting ?? data.program)?.status,
      "closed",
    );
  } else if (name === "staff_change_feedback_status") {
    const submission = record(data.submission);
    addChange(changes, "Status", submission?.status, body?.status);
    addChange(changes, "Outcome", submission?.outcome, body?.outcome);
  } else if (name === "staff_assign_feedback") {
    addFields(
      changes,
      record(record(data.submission)?.assignment),
      body,
      "Assignment · ",
    );
  } else if (name === "staff_request_feedback_details") {
    addChange(
      changes,
      "Status",
      record(data.submission)?.status,
      "waiting_on_resident",
    );
  } else if (name === "reopen_feedback") {
    addChange(changes, "Status", record(data.submission)?.status, "reopened");
  } else if (name === "staff_record_feedback_outcome") {
    const submission = record(data.submission);
    addChange(changes, "Status", submission?.status, "outcome_recorded");
    addChange(changes, "Outcome", submission?.outcome, body?.summary);
  } else if (
    name === "staff_change_application_status" ||
    name === "change_program_application_status" ||
    name === "record_application_decision"
  ) {
    addChange(
      changes,
      "Status",
      record(data.application)?.status,
      body?.status,
    );
  } else if (name === "edit_taxonomy_draft") {
    addChange(
      changes,
      "Taxonomy document",
      record(data.draft)?.document,
      body?.document,
    );
  } else if (name === "publish_taxonomy_draft") {
    addChange(changes, "Draft status", record(data.draft)?.status, "published");
  } else if (name === "create_taxonomy_draft") {
    addChange(changes, "Draft status", record(data.draft)?.status, "draft");
  } else if (name === "correct_classification") {
    addFields(changes, record(data.classification), body);
  } else if (name === "review_feedback_theme_membership") {
    if (Array.isArray(data.sources))
      addChange(
        changes,
        "Submission in theme",
        data.sources.some((source) => record(source)?.id === args.submissionId),
        true,
      );
  }
  if (MESSAGE_TOOLS.has(name))
    addChange(changes, "Message", null, body?.message);
  if (name === "record_application_decision")
    addChange(changes, "Applicant message", null, body?.message);
  return changes;
}
