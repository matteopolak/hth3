export type ProgramKind = "grant" | "benefit";
export type ProgramStatus = "draft" | "published" | "closed";
export type ProgramApplicationStatus =
  | "submitted"
  | "under_review"
  | "information_requested"
  | "approved"
  | "declined";

export interface ProgramQuestion {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "select";
  required: boolean;
  options?: string[];
}

export function parseProgramQuestions(
  value: unknown,
): ProgramQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24)
    return null;
  const ids = new Set<string>();
  const questions: ProgramQuestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const question = item as Record<string, unknown>;
    if (
      typeof question.id !== "string" ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(question.id) ||
      ids.has(question.id) ||
      typeof question.label !== "string" ||
      !question.label.trim() ||
      question.label.length > 160 ||
      !["short_text", "long_text", "select"].includes(String(question.type)) ||
      typeof question.required !== "boolean"
    )
      return null;
    ids.add(question.id);
    if (question.type === "select") {
      if (
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        question.options.length > 20 ||
        question.options.some(
          (option) =>
            typeof option !== "string" || !option.trim() || option.length > 120,
        )
      )
        return null;
      questions.push({
        id: question.id,
        label: question.label.trim(),
        type: "select",
        required: question.required,
        options: question.options as string[],
      });
    } else {
      questions.push({
        id: question.id,
        label: question.label.trim(),
        type: question.type as "short_text" | "long_text",
        required: question.required,
      });
    }
  }
  return questions;
}

export function parseProgramAnswers(
  value: unknown,
  questions: readonly ProgramQuestion[],
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !questions.some((question) => question.id === key),
    )
  )
    return null;
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const raw = input[question.id];
    if (raw === undefined || raw === null || raw === "") {
      if (question.required) return null;
      continue;
    }
    if (typeof raw !== "string") return null;
    const answer = raw.trim();
    const limit = question.type === "long_text" ? 4000 : 500;
    if (
      !answer ||
      answer.length > limit ||
      (question.type === "select" && !question.options?.includes(answer))
    )
      return null;
    answers[question.id] = answer;
  }
  return answers;
}

export const PROGRAM_APPLICATION_TRANSITIONS: Readonly<
  Record<ProgramApplicationStatus, readonly ProgramApplicationStatus[]>
> = {
  submitted: ["under_review", "information_requested"],
  under_review: ["information_requested", "approved", "declined"],
  information_requested: ["under_review", "declined"],
  approved: [],
  declined: [],
};
