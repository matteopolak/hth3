import type { ToolArguments } from "./types.js";

export interface ProposalChange {
  field: string;
  before: unknown;
  after: unknown;
}

type RecordValue = Record<string, unknown>;

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
  if (!data) return [];
  const changes: ProposalChange[] = [];
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
  } else if (name === "correct_classification") {
    addFields(changes, record(data.classification), body);
  }
  return changes;
}
