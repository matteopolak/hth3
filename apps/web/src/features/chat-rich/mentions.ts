export interface MentionableTool {
  name: string;
  access: "read" | "write";
  description: string;
}

const labels: Record<string, [string, string]> = {
  search_discovery: ["Explore services", "Explorer les services"],
  list_sources: ["Source library", "Bibliothèque des sources"],
  list_source_records: ["Source records", "Dossiers sources"],
  list_postings: ["Job postings", "Offres d’emploi"],
  list_my_applications: ["My applications", "Mes candidatures"],
  list_resumes: ["My résumés", "Mes CV"],
  read_profile: ["My profile", "Mon profil"],
  create_feedback: ["Report an issue", "Signaler un problème"],
  list_staff_feedback: ["Feedback inbox", "Boîte des signalements"],
  read_feedback_analytics: ["Feedback trends", "Tendances des signalements"],
  list_staff_applications: ["Applicants", "Candidats"],
  read_taxonomy: ["Feedback categories", "Catégories de signalements"],
};

const descriptions: Record<string, [string, string]> = {
  search_discovery: [
    "Find public opportunities and services.",
    "Trouver des possibilités et des services publics.",
  ],
  list_sources: [
    "See the public organizations behind Envoy's information.",
    "Voir les organismes publics à l’origine des renseignements d’Envoy.",
  ],
  list_source_records: [
    "Browse Envoy's public information library.",
    "Parcourir la bibliothèque d’information publique d’Envoy.",
  ],
  list_postings: ["See available jobs.", "Voir les emplois disponibles."],
  list_programs: [
    "Explore grants and benefit programs.",
    "Explorer les subventions et les programmes d’aide.",
  ],
  search_nearby: [
    "Find public services near a place.",
    "Trouver des services publics près d’un lieu.",
  ],
  list_consultations: [
    "Find current ways to take part.",
    "Trouver des occasions actuelles de participer.",
  ],
  create_feedback: [
    "Draft a report for your review before sending.",
    "Préparer un signalement à vérifier avant l’envoi.",
  ],
  check_feedback_duplicate: [
    "Check whether a similar issue is already being handled.",
    "Vérifier si un problème semblable est déjà traité.",
  ],
  list_my_applications: [
    "Check your applications and their status.",
    "Consulter vos candidatures et leur état.",
  ],
  read_profile: [
    "Review your saved profile.",
    "Consulter votre profil enregistré.",
  ],
  list_resumes: ["Review your saved résumés.", "Consulter vos CV enregistrés."],
  prepare_resume_upload: [
    "Open the résumé file picker.",
    "Ouvrir le sélecteur de fichier CV.",
  ],
  list_staff_feedback: [
    "Review reports in your organization's inbox.",
    "Consulter les signalements de votre organisation.",
  ],
  read_feedback_analytics: [
    "See trends in your organization's reports.",
    "Voir les tendances des signalements de votre organisation.",
  ],
  list_staff_applications: [
    "Review applicants for your organization.",
    "Examiner les candidatures de votre organisation.",
  ],
};

const hiddenMentions = new Set([
  "read_posting",
  "read_program",
  "read_source_record",
  "read_consultation",
  "read_discovery_item",
  "read_curator_source",
  "read_curator_source_change",
  "read_saved_view",
  "read_saved_report",
  "read_feedback_theme",
  "read_staff_feedback",
  "read_staff_application",
  "read_staff_resume",
]);

export function toolLabel(name: string, locale: "en" | "fr"): string {
  const known = labels[name];
  if (known) return known[locale === "fr" ? 1 : 0];
  const words = name
    .replace(/^staff_/, "")
    .replaceAll("_", " ")
    .trim();
  return words ? words[0]!.toLocaleUpperCase(locale) + words.slice(1) : "Tool";
}

export function toolDescription(
  tool: MentionableTool,
  locale: "en" | "fr",
): string {
  const known = descriptions[tool.name];
  if (known) return known[locale === "fr" ? 1 : 0];
  const label = toolLabel(tool.name, locale).toLocaleLowerCase(locale);
  return locale === "fr"
    ? `Demander à Envoy de vous aider avec ${label}.`
    : `Ask Envoy to help with ${label}.`;
}

export function mentionableTools<T extends MentionableTool>(tools: T[]): T[] {
  return tools.filter((tool) => !hiddenMentions.has(tool.name));
}

export function mentionQueryAtCaret(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@([\p{L}\p{N}_-]*)$/u.exec(before);
  if (!match) return null;
  return { start: before.length - match[2]!.length - 1, query: match[2]! };
}

export function matchingTools<T extends MentionableTool>(
  tools: T[],
  query: string,
  locale: "en" | "fr",
): T[] {
  const needle = query.toLocaleLowerCase(locale);
  return tools
    .filter((tool) =>
      `${toolLabel(tool.name, locale)} ${toolDescription(tool, locale)} ${tool.name}`
        .toLocaleLowerCase(locale)
        .includes(needle),
    )
    .slice(0, 8);
}

export function toolReferencePrefix(names: string[]): string {
  return names.map((name) => `[[tool:${name}]]`).join(" ");
}

export function visibleToolReferences(content: string): {
  names: string[];
  text: string;
} {
  const names: string[] = [];
  let rest = content;
  while (true) {
    const match = /^\[\[tool:([a-z][a-z0-9_]{1,79})\]\](?:\s+|$)/.exec(rest);
    if (!match) break;
    names.push(match[1]!);
    rest = rest.slice(match[0].length);
  }
  return { names, text: rest };
}
