import type { AgentMode, ToolArguments } from "./types.js";

interface SelectedTool {
  name: string;
  args: ToolArguments;
}

interface VacancyItem {
  title?: unknown;
  listing?: { closingDate?: unknown } | null;
}

/** High-confidence current job searches use verified individual listings. */
export function currentJobPostingsTool(
  message: string,
): SelectedTool | undefined {
  if (
    !/\b(job|jobs|posting|postings|vacancy|vacancies|opening|openings|career|careers|role|roles|emploi|emplois|offre|offres|poste|postes|carrière|carrières)\b/iu.test(
      message,
    ) ||
    !/\b(find|show|list|search|browse|looking for|current|open|available|closing|deadline|trouver|montrer|lister|chercher|actuel|actuelle|actuels|actuelles|ouvert|ouverts|disponible|disponibles|clôture)\b/iu.test(
      message,
    ) ||
    /\b(?:how|comment)\s+(?:do|can|to|puis|peux).*\b(?:apply|postuler)\b/iu.test(
      message,
    )
  )
    return undefined;
  const cityOttawa = /\b(?:City of Ottawa|Ville d['’]Ottawa)\b/iu.test(message);
  const cityToronto = /\b(?:City of Toronto|Ville de Toronto)\b/iu.test(
    message,
  );
  const bcPublicService =
    /\b(?:BC Public Service|British Columbia Public Service|fonction publique de la Colombie-Britannique)\b/iu.test(
      message,
    );
  const location = cityOttawa
    ? undefined
    : cityToronto
      ? undefined
      : /\b(?:British Columbia|Colombie-Britannique|BC)\b/iu.test(message)
        ? "British Columbia"
        : /\bToronto\b/iu.test(message)
          ? "Toronto"
          : /\bOttawa\b/iu.test(message)
            ? "Ottawa"
            : message.match(
                /(?:\b(?:in|near|around|dans|au|aux)\b|à)\s+([A-ZÀ-ÖØ-Þ][\p{L}’'.-]*(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}’'.-]*){0,2})/u,
              )?.[1];
  return {
    name: "search_discovery",
    args: {
      area: "jobs",
      type: "job_posting",
      ...(cityOttawa
        ? { source: "city-ottawa-open-jobs" }
        : cityToronto
          ? { source: "city-toronto-open-jobs" }
          : bcPublicService
            ? { source: "bc-public-service-vacancies" }
            : location
              ? { location }
              : {}),
      applicationStatus: "open",
      limit: 12,
    },
  };
}

export function currentJobPostingsAnswer(
  data: unknown,
  locale: "en" | "fr",
  args: ToolArguments,
): string {
  const result = data as { items?: VacancyItem[]; total?: number } | null;
  const items = Array.isArray(result?.items) ? result.items : [];
  const count =
    typeof result?.total === "number" && Number.isFinite(result.total)
      ? result.total
      : items.length;
  if (count === 0)
    return locale === "fr"
      ? "Je n'ai trouvé aucune offre d'emploi ouverte correspondante dans les sources publiées."
      : "I found no matching open job postings in the published sources.";
  const sample = items
    .slice(0, 3)
    .map((item) => {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const closing =
        typeof item.listing?.closingDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.listing.closingDate)
          ? item.listing.closingDate
          : null;
      return title && closing ? `${title} (${closing})` : title;
    })
    .filter(Boolean);
  const source = args.source;
  const scope =
    source === "city-ottawa-open-jobs"
      ? locale === "fr"
        ? "de la Ville d'Ottawa"
        : "from the City of Ottawa"
      : source === "city-toronto-open-jobs"
        ? locale === "fr"
          ? "de la Ville de Toronto"
          : "from the City of Toronto"
        : source === "bc-public-service-vacancies"
          ? locale === "fr"
            ? "de la fonction publique de la Colombie-Britannique"
            : "from the BC Public Service"
          : typeof args.location === "string"
            ? locale === "fr"
              ? `pour ${args.location}`
              : `for ${args.location}`
            : "";
  const heading =
    locale === "fr"
      ? `J'ai trouvé ${count} offres d'emploi ouvertes ${scope}`.trim() + "."
      : `I found ${count} open job postings ${scope}`.trim() + ".";
  return sample.length
    ? `${heading} ${sample.join("; ")}${count > sample.length ? (locale === "fr" ? "; les autres offres et dates de clôture figurent ci-dessous." : "; the remaining roles and closing dates are below.") : "."}`
    : heading;
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
