export type TaxonomyIntent =
  | "complaint"
  | "suggestion"
  | "question"
  | "positive";

export interface BilingualText {
  en: string;
  fr: string;
}

export interface TaxonomyGroup {
  id: string;
  name: BilingualText;
  order: number;
}

export interface TaxonomyCategory {
  id: string;
  groupId: string;
  name: BilingualText;
  description: BilingualText;
  inclusionExamples: BilingualText[];
  exclusionExamples: BilingualText[];
  followUpFields: Array<{ id: string; label: BilingualText }>;
  destinationDepartmentId: string;
  jurisdictionLevel: "municipal" | "provincial" | "federal" | "mixed";
  order: number;
  retired: boolean;
}

export interface TaxonomyDocument {
  groups: TaxonomyGroup[];
  categories: TaxonomyCategory[];
}

export type DepartmentJurisdictionLevel =
  | "municipal"
  | "provincial"
  | "federal"
  | "review_only";

export interface ClassificationProposal {
  intent: TaxonomyIntent;
  categoryId: string;
  confidence: number;
  alternatives: string[];
}

const ID = /^[a-z][a-z0-9_]{1,63}$/;
const INTENTS = ["complaint", "suggestion", "question", "positive"];

export function validateTaxonomyDocument(
  value: unknown,
  destinations: ReadonlyMap<string, DepartmentJurisdictionLevel>,
):
  | { valid: true; document: TaxonomyDocument }
  | { valid: false; reason: string } {
  if (
    !isRecord(value) ||
    !Array.isArray(value.groups) ||
    !Array.isArray(value.categories)
  )
    return invalid("Provide groups and categories arrays.");
  if (
    value.groups.length < 1 ||
    value.groups.length > 20 ||
    value.categories.length < 1 ||
    value.categories.length > 128
  )
    return invalid("Use 1–20 groups and 1–128 categories.");
  const groupIds = new Set<string>();
  for (const group of value.groups) {
    if (
      !isRecord(group) ||
      !identifier(group.id) ||
      !bilingual(group.name) ||
      !order(group.order)
    )
      return invalid("Each group needs an ID, bilingual name, and order.");
    if (groupIds.has(group.id as string))
      return invalid("Group IDs must be unique.");
    groupIds.add(group.id as string);
  }
  const categoryIds = new Set<string>();
  let otherActive = false;
  for (const category of value.categories) {
    if (
      !isRecord(category) ||
      !identifier(category.id) ||
      !groupIds.has(category.groupId as string) ||
      !bilingual(category.name) ||
      !bilingual(category.description) ||
      !order(category.order) ||
      typeof category.retired !== "boolean" ||
      !destinations.has(category.destinationDepartmentId as string) ||
      !["municipal", "provincial", "federal", "mixed"].includes(
        category.jurisdictionLevel as string,
      )
    )
      return invalid(
        "Each category needs a unique ID, valid group, bilingual name and description, order, status, and active destination.",
      );
    if (categoryIds.has(category.id as string))
      return invalid("Category IDs must be unique.");
    categoryIds.add(category.id as string);
    const destinationLevel = destinations.get(
      category.destinationDepartmentId as string,
    );
    if (
      destinationLevel !== "review_only" &&
      destinationLevel !== category.jurisdictionLevel
    )
      return invalid(
        "A category cannot route to a department at another jurisdiction level.",
      );
    if (category.id === "other_or_unsure" && !category.retired)
      otherActive = true;
    if (
      !examples(category.inclusionExamples) ||
      !examples(category.exclusionExamples)
    )
      return invalid(
        "Category inclusion and exclusion examples must be bilingual arrays.",
      );
    if (
      !Array.isArray(category.followUpFields) ||
      category.followUpFields.length > 8 ||
      !category.followUpFields.every(
        (field: unknown) =>
          isRecord(field) && identifier(field.id) && bilingual(field.label),
      )
    )
      return invalid("Follow-up fields need an ID and bilingual label.");
  }
  if (!otherActive)
    return invalid("An active other_or_unsure route is required.");
  return { valid: true, document: value as unknown as TaxonomyDocument };
}

export function validateClassificationProposal(
  value: unknown,
  taxonomy: TaxonomyDocument,
  minimumConfidence = 0.65,
): {
  proposal: ClassificationProposal;
  needsReview: boolean;
  reason: string | null;
} {
  const fallback: ClassificationProposal = {
    intent: "question",
    categoryId: "other_or_unsure",
    confidence: 0,
    alternatives: [],
  };
  if (
    !isRecord(value) ||
    !INTENTS.includes(value.intent as string) ||
    typeof value.categoryId !== "string" ||
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    return {
      proposal: fallback,
      needsReview: true,
      reason: "invalid_model_output",
    };
  }
  const category = taxonomy.categories.find(
    (item) => item.id === value.categoryId && !item.retired,
  );
  if (!category)
    return {
      proposal: fallback,
      needsReview: true,
      reason: "unknown_category",
    };
  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives
        .filter(
          (id: unknown): id is string =>
            typeof id === "string" &&
            id !== category.id &&
            taxonomy.categories.some((item) => item.id === id && !item.retired),
        )
        .slice(0, 3)
    : [];
  const proposal = {
    intent: value.intent as TaxonomyIntent,
    categoryId: category.id,
    confidence: value.confidence,
    alternatives,
  };
  if (category.id === "other_or_unsure")
    return { proposal, needsReview: true, reason: "other_or_unsure" };
  return {
    proposal,
    needsReview: proposal.confidence < minimumConfidence,
    reason: proposal.confidence < minimumConfidence ? "low_confidence" : null,
  };
}

function invalid(reason: string): { valid: false; reason: string } {
  return { valid: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function bilingual(value: unknown): value is BilingualText {
  return (
    isRecord(value) &&
    [value.en, value.fr].every(
      (part) =>
        typeof part === "string" &&
        part.trim().length > 0 &&
        part.length <= 500,
    )
  );
}

function examples(value: unknown): value is BilingualText[] {
  return Array.isArray(value) && value.length <= 8 && value.every(bilingual);
}

function order(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000;
}
