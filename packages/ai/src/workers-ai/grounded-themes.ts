import { THEME_EMBEDDING_DIMENSIONS } from "../vectorize/themes.js";

export const THEME_EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";
export const THEME_SUMMARY_MODEL = "@cf/ibm-granite/granite-4.0-h-micro";

export interface ThemeAiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

export interface ThemeSource {
  id: string;
  originalText: string;
  constructiveFollowUp: string | null;
}

export function redactThemeText(text: string): string {
  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[link]")
    .replace(/\+?\d[\d ().-]{7,}\d/g, "[phone]")
    .replace(/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/gi, "[postal code]")
    .replace(
      /\b\d{1,6}\s+(?:[\p{L}.]+\s+){0,3}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|rue|chemin)\b/giu,
      "[address]",
    )
    .replace(
      /\b(?:my name is|je m'appelle|je suis)\s+[\p{L}'-]+(?:\s+[\p{L}'-]+)?/giu,
      "[name]",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export async function embedThemeSources(
  ai: ThemeAiBinding,
  sources: ThemeSource[],
): Promise<number[][]> {
  if (sources.length === 0 || sources.length > 24)
    throw new Error("Theme embedding batch is outside the guarded limit.");
  const response = await ai.run(THEME_EMBEDDING_MODEL, {
    text: sources.map((source) =>
      redactThemeText(
        `${source.originalText} ${source.constructiveFollowUp ?? ""}`,
      ).slice(0, 500),
    ),
  });
  const data = (response as { data?: unknown })?.data;
  if (
    !Array.isArray(data) ||
    data.length !== sources.length ||
    data.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== THEME_EMBEDDING_DIMENSIONS ||
        vector.some(
          (value) => typeof value !== "number" || !Number.isFinite(value),
        ),
    )
  )
    throw new Error("Workers AI returned an invalid theme embedding response.");
  return data as number[][];
}

export async function summarizeGroundedTheme(
  ai: ThemeAiBinding,
  sources: ThemeSource[],
): Promise<{ en: string; fr: string; sourceIds: string[] }> {
  if (sources.length < 3 || sources.length > 5)
    throw new Error("Grounded theme summaries require 3–5 sources.");
  const evidence = sources.map((source) => ({
    id: source.id,
    text: redactThemeText(
      `${source.originalText} ${source.constructiveFollowUp ?? ""}`,
    ).slice(0, 400),
  }));
  const result = await ai.run(THEME_SUMMARY_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "Summarize only the provided civic feedback. Return compact JSON with en, fr, sourceIds. Each summary must describe the common concern and requested change in one sentence. Do not add a count, quote a person, infer identity, or invent a fact. sourceIds must be IDs from the input.",
      },
      { role: "user", content: JSON.stringify(evidence) },
    ],
    max_tokens: 220,
    temperature: 0,
  });
  const raw = readGeneratedText(result);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Workers AI did not return a grounded summary.");
  const parsed = JSON.parse(match[0]) as {
    en?: unknown;
    fr?: unknown;
    sourceIds?: unknown;
  };
  const allowed = new Set(evidence.map((item) => item.id));
  if (
    typeof parsed.en !== "string" ||
    typeof parsed.fr !== "string" ||
    !Array.isArray(parsed.sourceIds) ||
    parsed.sourceIds.length === 0 ||
    parsed.sourceIds.some((id) => typeof id !== "string" || !allowed.has(id)) ||
    parsed.en.length > 500 ||
    parsed.fr.length > 500
  )
    throw new Error("Workers AI summary lacked valid source evidence.");
  return {
    en: parsed.en.trim(),
    fr: parsed.fr.trim(),
    sourceIds: [...new Set(parsed.sourceIds as string[])],
  };
}

function readGeneratedText(value: unknown): string {
  const result = value as {
    response?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = result?.response ?? result?.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw new Error("Workers AI returned no summary text.");
  return content;
}
