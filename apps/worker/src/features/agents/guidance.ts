import type { AgentMode, ToolArguments } from "./types.js";

interface SelectedTool {
  name: string;
  args: ToolArguments;
}

/** Keep a model's broad catalogue choice from drowning a specific job search. */
export function relevantToolForMessage(
  message: string,
  selected: SelectedTool | undefined,
): SelectedTool | undefined {
  if (
    !selected ||
    (selected.name !== "list_sources" &&
      selected.name !== "list_source_records") ||
    !/\b(job|jobs|career|careers|employment|hiring|vacanc(?:y|ies)|emploi|emplois|carrière|carrières|poste|postes)\b/iu.test(
      message,
    ) ||
    !/\b(find|search|where|looking|list|show|browse|trouver|chercher|où|voir|offres?)\b/iu.test(
      message,
    )
  )
    return selected;

  const explicitLocation =
    typeof selected.args.location === "string" &&
    selected.args.location.length <= 80
      ? selected.args.location.trim()
      : null;
  const namedLocation = message.match(
    /(?:\b(?:in|near|around|dans)\b|\bà\b)\s+([A-ZÀ-ÖØ-Þ][\p{L}’'.-]*(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}’'.-]*){0,2})/u,
  )?.[1];
  return {
    name: "search_discovery",
    args: {
      area: "jobs",
      ...(explicitLocation || namedLocation
        ? { location: explicitLocation || namedLocation }
        : {}),
      limit: 8,
    },
  };
}

export function isCapabilityQuestion(message: string): boolean {
  return /^(?:what can you do|how can you help(?: me)?|what can you help me with|que peux[- ]tu faire|comment peux[- ]tu m['’]aider|qu['’]est[- ]ce que tu peux faire)[?.!\s]*$/iu.test(
    message.trim(),
  );
}

export function capabilityAnswer(
  mode: AgentMode,
  locale: "en" | "fr",
  organizationId: string | null,
): string {
  if (mode === "resident")
    return locale === "fr"
      ? "Je peux chercher des emplois, des programmes et des services avec leurs sources officielles, et vous aider à préparer un signalement. Si vous vous connectez, je peux aussi vous aider avec votre profil, vos candidatures et vos éléments enregistrés; vous approuvez chaque action avant son envoi."
      : "I can find jobs, programs, and services with their official sources, and help you prepare a service report. If you sign in, I can also help with your profile, applications, and saved items; you review each action before it is submitted.";
  if (!organizationId)
    return locale === "fr"
      ? "Je peux examiner les sources publiques et aider à proposer ou réviser des corrections à leurs métadonnées officielles selon vos permissions. Les dossiers et autres outils d’organisation nécessitent une adhésion à cette organisation; vous approuvez chaque modification."
      : "I can review public sources and help propose or review corrections to official source metadata when your permissions allow it. Organization cases and other workspace actions require membership there; you approve each change.";
  return locale === "fr"
    ? "Selon vos permissions dans l’organisation, je peux aider à examiner les signalements, les candidatures, les offres, les programmes, les thèmes, les rapports et les paramètres. Je peux chercher leurs dossiers et préparer des modifications à vérifier avant leur exécution."
    : "Within your organization permissions, I can help review reports, applications, postings, programs, themes, analytics, and settings. I can find records and prepare changes for your review before they run.";
}
