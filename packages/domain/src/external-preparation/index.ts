export const EXTERNAL_PREPARATION_STATUS = "prepared-for-external" as const;

export interface PreparedAnswer {
  id: string;
  question: string;
  response: string;
}

export interface PreparationStep {
  id: string;
  text: string;
  done: boolean;
}

export interface ExternalPreparation {
  answers: PreparedAnswer[];
  checklist: PreparationStep[];
  status: typeof EXTERNAL_PREPARATION_STATUS;
}

export interface ReusableAnswer {
  id: string;
  label: string;
  response: string;
}

const ID = /^[A-Za-z0-9_-]{1,48}$/;

export function validateExternalPreparation(
  value: unknown,
): ExternalPreparation | null {
  if (
    !isObject(value) ||
    !Array.isArray(value.answers) ||
    !Array.isArray(value.checklist)
  )
    return null;
  if (value.answers.length > 24 || value.checklist.length > 20) return null;
  const answerIds = new Set<string>();
  const stepIds = new Set<string>();
  const answers: PreparedAnswer[] = [];
  const checklist: PreparationStep[] = [];
  for (const entry of value.answers) {
    if (
      !isObject(entry) ||
      typeof entry.id !== "string" ||
      !ID.test(entry.id) ||
      answerIds.has(entry.id) ||
      typeof entry.question !== "string" ||
      entry.question.trim().length < 1 ||
      entry.question.trim().length > 240 ||
      typeof entry.response !== "string" ||
      entry.response.length > 4_000
    )
      return null;
    answerIds.add(entry.id);
    answers.push({
      id: entry.id,
      question: entry.question.trim(),
      response: entry.response.trim(),
    });
  }
  for (const entry of value.checklist) {
    if (
      !isObject(entry) ||
      typeof entry.id !== "string" ||
      !ID.test(entry.id) ||
      stepIds.has(entry.id) ||
      typeof entry.text !== "string" ||
      entry.text.trim().length < 1 ||
      entry.text.trim().length > 240 ||
      typeof entry.done !== "boolean"
    )
      return null;
    stepIds.add(entry.id);
    checklist.push({ id: entry.id, text: entry.text.trim(), done: entry.done });
  }
  return { answers, checklist, status: EXTERNAL_PREPARATION_STATUS };
}

export function validateReusableAnswer(value: unknown): ReusableAnswer | null {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    !ID.test(value.id) ||
    typeof value.label !== "string" ||
    value.label.trim().length < 1 ||
    value.label.trim().length > 120 ||
    typeof value.response !== "string" ||
    value.response.trim().length < 1 ||
    value.response.length > 4_000
  )
    return null;
  return {
    id: value.id,
    label: value.label.trim(),
    response: value.response.trim(),
  };
}

export function formatPreparationDocument(input: {
  title: string;
  publisher: string;
  officialUrl: string;
  preparation: ExternalPreparation;
  locale: "en" | "fr";
  purpose?: "application" | "participation";
}): string {
  const fr = input.locale === "fr";
  const participation = input.purpose === "participation";
  const lines = [
    input.title,
    `${fr ? "Éditeur" : "Publisher"}: ${input.publisher}`,
    `${fr ? "Site officiel" : "Official site"}: ${input.officialUrl}`,
    "",
    fr ? "Réponses préparées" : "Prepared answers",
    ...input.preparation.answers.flatMap((answer) => [
      answer.question,
      answer.response || "—",
      "",
    ]),
    fr ? "Liste de contrôle personnelle" : "Personal checklist",
    ...input.preparation.checklist.map(
      (step) => `${step.done ? "[x]" : "[ ]"} ${step.text}`,
    ),
    "",
    participation
      ? fr
        ? "Préparé pour une participation externe. Vérifiez les renseignements actuels et contribuez vous-même sur le site officiel. Envoy n'a enregistré aucune contribution externe."
        : "Prepared for external participation. Check current details and contribute yourself on the official site. Envoy has not recorded an external contribution."
      : fr
        ? "Préparé pour une demande externe. Vérifiez les exigences et soumettez vous-même sur le site officiel. Envoy n'a enregistré aucune soumission externe."
        : "Prepared for an external application. Check requirements and submit yourself on the official site. Envoy has not recorded an external submission.",
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
