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

export function canStaffRequestDetails(status: FeedbackStatus): boolean {
  return canTransitionFeedback(status, "waiting_on_resident");
}

export function canStaffRecordOutcome(status: FeedbackStatus): boolean {
  return canTransitionFeedback(status, "outcome_recorded");
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

/** Normalize only presentation differences before comparing substantial reports. */
export function normalizeFeedbackDuplicateText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    // Seeded practice cases carry a transparent label that is not part of the report.
    .replace(/^\s*\[\s*practice\s*\]\s*/iu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const words = normalized.split(" ").filter(Boolean);
  if (normalized.length < 48 || words.length < 7) return null;
  return normalized;
}

/** Require a high character-bigram overlap; short or generic text never matches. */
export function areStrongFeedbackDuplicates(
  left: unknown,
  right: unknown,
): boolean {
  const normalizedLeft = normalizeFeedbackDuplicateText(left);
  const normalizedRight = normalizeFeedbackDuplicateText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftBigrams = characterBigrams(normalizedLeft);
  const rightBigrams = characterBigrams(normalizedRight);
  let intersection = 0;
  for (const [bigram, leftCount] of leftBigrams) {
    intersection += Math.min(leftCount, rightBigrams.get(bigram) ?? 0);
  }
  const denominator =
    countOccurrences(leftBigrams) + countOccurrences(rightBigrams);
  return denominator > 0 && (2 * intersection) / denominator >= 0.94;
}

function characterBigrams(value: string): Map<string, number> {
  const characters = Array.from(value);
  const bigrams = new Map<string, number>();
  for (let index = 0; index < characters.length - 1; index += 1) {
    const bigram = characters[index]! + characters[index + 1]!;
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }
  return bigrams;
}

function countOccurrences(values: Map<string, number>): number {
  let count = 0;
  for (const value of values.values()) count += value;
  return count;
}
