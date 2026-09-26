import type {
  CaseStatus,
  Category,
  Classification,
  Role,
} from "@civicresolve/contracts";

const next: Record<CaseStatus, CaseStatus[]> = {
  submitted: ["classified", "needs_review"],
  classified: ["assigned", "needs_review"],
  needs_review: ["assigned"],
  assigned: ["acknowledged"],
  acknowledged: ["in_progress"],
  in_progress: ["waiting_on_resident", "resolved"],
  waiting_on_resident: ["in_progress", "resolved"],
  resolved: ["reopened", "closed"],
  reopened: ["assigned", "in_progress"],
  closed: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return next[from].includes(to);
}

export function canManageCases(role: Role): boolean {
  return (
    role === "reviewer" ||
    role === "department_admin" ||
    role === "organization_owner"
  );
}

export function canPublishTaxonomy(role: Role): boolean {
  return role === "organization_owner";
}

export function validateClassification(
  result: Classification,
  taxonomy: Category[],
): Classification {
  const category = taxonomy.find(
    (item) => item.id === result.categoryId && item.status === "published",
  );
  if (!category || category.version !== result.taxonomyVersion)
    throw new Error("Classifier returned an inactive category");
  return result;
}

const terms: Record<string, string[]> = {
  sidewalk: ["sidewalk", "pavement", "trip", "curb", "footpath"],
  water: ["water", "leak", "pipe", "flood", "hydrant"],
  lighting: ["light", "lamp", "dark", "streetlight"],
  waste: ["trash", "garbage", "bin", "litter", "waste"],
  road: ["road", "pothole", "asphalt", "traffic", "street"],
  other: [],
};

const stopwords = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "near",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "issue",
  "issues",
  "public",
  "service",
  "services",
  "damaged",
  "broken",
]);
const words = (value: string) => value.toLowerCase().match(/[a-z]{3,}/g) ?? [];

export function fixtureClassify(
  text: string,
  taxonomy: Category[],
): Classification {
  const inputWords = new Set(words(text));
  const ranked = taxonomy
    .filter((item) => item.status === "published")
    .map((item) => {
      const categoryWords = new Set(
        [
          ...(terms[item.id] ?? []),
          ...words(
            `${item.name} ${item.description} ${item.examples.join(" ")}`,
          ),
        ].filter((word) => !stopwords.has(word)),
      );
      const excluded = item.exclusions.some((phrase) =>
        text.toLowerCase().includes(phrase.toLowerCase()),
      );
      return {
        item,
        score: excluded
          ? -1
          : [...categoryWords].filter((word) => inputWords.has(word)).length,
      };
    })
    .sort((a, b) => b.score - a.score);
  const chosen = ranked[0];
  if (!chosen) throw new Error("No published taxonomy");
  return validateClassification(
    {
      categoryId: chosen.item.id,
      confidence: chosen.score > 1 ? 0.91 : chosen.score === 1 ? 0.78 : 0.35,
      rationale: chosen.score
        ? "Matched published category examples and terms."
        : "No clear category match; human review required.",
      provider: "fixture",
      taxonomyVersion: chosen.item.version,
    },
    taxonomy,
  );
}

export function requiresReview(result: Classification): boolean {
  return result.confidence < 0.7 || result.categoryId === "other";
}
