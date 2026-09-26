export type FeedbackStatus =
  | "submitted"
  | "acknowledged"
  | "in_review"
  | "waiting_on_resident"
  | "outcome_recorded"
  | "closed"
  | "reopened";

export const FEEDBACK_CATEGORIES = [
  "roads_and_sidewalks",
  "public_transit",
  "parks_and_trees",
  "water_and_wastewater",
  "waste_collection",
  "housing_and_shelter",
  "other_or_unsure",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_TRANSITIONS: Readonly<
  Record<FeedbackStatus, readonly FeedbackStatus[]>
> = {
  submitted: ["acknowledged"],
  acknowledged: ["in_review"],
  in_review: ["waiting_on_resident", "outcome_recorded"],
  waiting_on_resident: ["in_review"],
  outcome_recorded: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["in_review"],
};

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    typeof value === "string" &&
    (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
  );
}

export function canTransitionFeedback(
  current: FeedbackStatus,
  next: FeedbackStatus,
): boolean {
  return FEEDBACK_TRANSITIONS[current].includes(next);
}

export function canResidentReopenFeedback(status: FeedbackStatus): boolean {
  return status === "outcome_recorded" || status === "closed";
}

/** Return the resident's exact text after checking that it is usable. */
export function preserveFeedbackText(
  value: unknown,
  maxLength: number,
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    return null;
  }
  return value;
}
