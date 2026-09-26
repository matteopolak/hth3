export interface SimilarityPair {
  firstId: string;
  secondId: string;
  score: number;
}

export interface ThemeMembershipForReview {
  submissionId: string;
  categoryId: string;
  themeId: string;
  source: "automatic" | "staff";
  createdAt: string;
}

export interface ThemeMembershipSuggestion {
  submissionId: string;
  currentThemeId: string;
  suggestedThemeId: string;
  categoryId: string;
  sourceIds: [string, string];
  similarityScore: number;
  reviewRequired: true;
}

// Custom or newly published categories stay protected until explicitly reviewed.
const NON_SENSITIVE_CATEGORIES = new Set([
  "roads_potholes",
  "sidewalks_crossings",
  "streetlights_signals",
  "transit_stops",
  "cycling_parking",
  "waste_recycling",
  "parks_recreation",
  "trees_landscaping",
  "noise_pollution",
  "water_drainage_sewer",
  "public_facilities_libraries",
]);

export function isSensitiveThemeCategory(categoryId: string): boolean {
  return !NON_SENSITIVE_CATEGORIES.has(categoryId);
}

export function canDescribeThemeSources(
  categoryId: string,
  count: number,
): boolean {
  return count >= 3 && !isSensitiveThemeCategory(categoryId);
}

export function proposeThemeMembershipReviews(
  pairs: SimilarityPair[],
  memberships: ThemeMembershipForReview[],
): ThemeMembershipSuggestion[] {
  const bySubmission = new Map(
    memberships.map((membership) => [membership.submissionId, membership]),
  );
  const suggestions = new Map<string, ThemeMembershipSuggestion>();
  for (const pair of pairs) {
    if (!Number.isFinite(pair.score) || pair.score < 0.84 || pair.score > 1)
      continue;
    const first = bySubmission.get(pair.firstId);
    const second = bySubmission.get(pair.secondId);
    if (
      !first ||
      !second ||
      first.categoryId !== second.categoryId ||
      first.themeId === second.themeId
    )
      continue;

    const [target, source] = preferredDirection(first, second);
    if (source.source === "staff") continue;
    const key = `${source.submissionId}:${target.themeId}`;
    const candidate: ThemeMembershipSuggestion = {
      submissionId: source.submissionId,
      currentThemeId: source.themeId,
      suggestedThemeId: target.themeId,
      categoryId: source.categoryId,
      sourceIds: [first.submissionId, second.submissionId],
      similarityScore: Math.round(pair.score * 1000) / 1000,
      reviewRequired: true,
    };
    if (
      candidate.similarityScore > (suggestions.get(key)?.similarityScore ?? 0)
    )
      suggestions.set(key, candidate);
  }
  return [...suggestions.values()]
    .sort(
      (a, b) =>
        b.similarityScore - a.similarityScore ||
        a.submissionId.localeCompare(b.submissionId),
    )
    .slice(0, 50);
}

function preferredDirection(
  first: ThemeMembershipForReview,
  second: ThemeMembershipForReview,
): [ThemeMembershipForReview, ThemeMembershipForReview] {
  if (first.source === "staff" && second.source !== "staff")
    return [first, second];
  if (second.source === "staff" && first.source !== "staff")
    return [second, first];
  return first.createdAt < second.createdAt ||
    (first.createdAt === second.createdAt &&
      first.submissionId < second.submissionId)
    ? [first, second]
    : [second, first];
}
