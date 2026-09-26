import type { Locale } from "@civicresolve/contracts/v1";
import "./styles.css";

type RecordValue = Record<string, unknown>;
type ResultKind = "source" | "theme" | "posting" | "application" | "feedback";

export interface ApprovalPreview {
  name?: string;
  body?: unknown;
  destinationNotice?: string;
  [key: string]: unknown;
}

export function agentResult(value: unknown, locale: Locale): HTMLElement {
  const result = record(parse(value));
  const status = typeof result?.status === "number" ? result.status : 200;
  const data = record(result?.data) ?? result;
  if (!data) return fallback(value, locale);
  if (status >= 400) return errorResult(data, status, locale);

  const collection = resultCollection(data);
  if (!collection) return fallback(value, locale);
  const { kind, items, total } = collection;
  const section = element("section", "agent-result");
  section.setAttribute("aria-label", label(kind, locale));
  const header = element("div", "agent-result-head");
  header.append(
    element("span", "agent-result-type", label(kind, locale)),
    element("strong", "agent-result-total", countLabel(kind, total, locale)),
  );
  section.append(header);
  if (!items.length) {
    section.append(
      element("p", "agent-result-empty", emptyLabel(kind, locale)),
    );
    return section;
  }
  const list = element("div", "agent-result-list");
  for (const item of items.slice(0, 6))
    list.append(resultItem(kind, item, locale));
  section.append(list);
  if (total > 6) {
    section.append(
      element(
        "p",
        "agent-result-more",
        locale === "fr"
          ? `${total - 6} autres résultats`
          : `${total - 6} more results`,
      ),
    );
  }
  return section;
}

export function agentApprovalIntro(
  preview: ApprovalPreview,
  locale: Locale,
): HTMLElement {
  const kind = approvalKind(preview.name);
  const wrapper = element("div", "agent-approval-intro");
  wrapper.append(
    element(
      "span",
      "agent-approval-state",
      locale === "fr"
        ? "En attente de votre approbation"
        : "Awaiting your approval",
    ),
    element("h3", "", approvalTitle(preview.name, kind, locale)),
  );
  const summary = approvalSummary(preview, kind);
  if (summary) wrapper.append(element("p", "", summary));
  return wrapper;
}

export function agentApprovalState(
  proposal: { status: "approved" | "rejected"; preview: ApprovalPreview },
  locale: Locale,
): HTMLElement {
  const card = element(
    "section",
    `agent-approval-complete is-${proposal.status}`,
  );
  card.setAttribute(
    "aria-label",
    locale === "fr" ? "État de l’action" : "Action status",
  );
  card.append(
    element(
      "span",
      "agent-approval-state",
      proposal.status === "approved"
        ? locale === "fr"
          ? "Approuvée"
          : "Approved"
        : locale === "fr"
          ? "Refusée"
          : "Declined",
    ),
    element(
      "strong",
      "",
      approvalTitle(
        proposal.preview.name,
        approvalKind(proposal.preview.name),
        locale,
      ),
    ),
  );
  return card;
}

function resultCollection(
  data: RecordValue,
): { kind: ResultKind; items: RecordValue[]; total: number } | null {
  const candidates: Array<[ResultKind, unknown, unknown]> = [
    ["feedback", data.submissions ?? data.submission, data.total],
    ["theme", data.themes ?? data.theme, data.totalSubmissions],
    ["application", data.applications ?? data.application, data.total],
    ["posting", data.postings ?? data.posting, data.total],
    [
      "source",
      data.records ??
        data.record ??
        data.items ??
        data.item ??
        data.sources ??
        data.source,
      data.total,
    ],
  ];
  for (const [kind, raw, rawTotal] of candidates) {
    if (raw === undefined) continue;
    const items = (Array.isArray(raw) ? raw : [raw])
      .map(record)
      .filter((item): item is RecordValue => item !== null);
    const total =
      typeof rawTotal === "number" &&
      Number.isFinite(rawTotal) &&
      rawTotal >= items.length
        ? rawTotal
        : items.length;
    return { kind, items, total };
  }
  return null;
}

function resultItem(
  kind: ResultKind,
  item: RecordValue,
  locale: Locale,
): HTMLElement {
  const row = element("article", "agent-result-item");
  const title = itemTitle(kind, item, locale);
  row.append(element("h4", "", title));
  const description = itemDescription(kind, item, locale);
  if (description && description !== title)
    row.append(element("p", "", description));
  const meta = element("div", "agent-result-meta");
  const sample = item.sample === true || item.origin === "sample";
  if (sample)
    meta.append(
      element(
        "span",
        "agent-result-badge",
        locale === "fr" ? "Donnée d’essai" : "Practice record",
      ),
    );
  if (kind === "source") {
    const publisher = string(item.publisher);
    if (publisher) meta.append(element("span", "", publisher));
    if (item.verified === true)
      meta.append(
        element(
          "span",
          "",
          locale === "fr" ? "Source vérifiée" : "Verified source",
        ),
      );
  }
  if (kind === "theme") {
    const count = number(item.count);
    if (count !== null)
      meta.append(
        element(
          "span",
          "",
          locale === "fr" ? `${count} signalements` : `${count} submissions`,
        ),
      );
  }
  if (kind === "posting" || kind === "application" || kind === "feedback") {
    const status = string(item.status);
    if (status) meta.append(element("span", "", status.replaceAll("_", " ")));
  }
  if (meta.childElementCount) row.append(meta);
  if (kind === "source") {
    const url = sample ? null : safeUrl(item.sourceUrl);
    if (url) {
      const link = element(
        "a",
        "agent-result-link",
        locale === "fr" ? "Voir la source" : "View source",
      );
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      row.append(link);
    }
  }
  return row;
}

function itemTitle(
  kind: ResultKind,
  item: RecordValue,
  locale: Locale,
): string {
  if (kind === "theme")
    return (
      localized(item.title, locale) ?? (locale === "fr" ? "Thème" : "Theme")
    );
  if (kind === "feedback")
    return (
      string(item.originalText)
        ?.split(/[.!?\n]/, 1)[0]
        ?.slice(0, 110) ?? (locale === "fr" ? "Signalement" : "Feedback")
    );
  return (
    string(item.title) ??
    string(item.name) ??
    string(item.postingTitle) ??
    (kind === "application"
      ? locale === "fr"
        ? "Candidature"
        : "Application"
      : locale === "fr"
        ? "Source"
        : "Source")
  );
}

function itemDescription(
  kind: ResultKind,
  item: RecordValue,
  locale: Locale,
): string | null {
  if (kind === "theme") return localized(item.summary, locale);
  if (kind === "source") return string(item.summary);
  if (kind === "application" || kind === "posting")
    return string(item.description) ?? string(item.location);
  return string(item.constructiveFollowUp) ?? string(item.outcome);
}

function approvalKind(name: unknown): ResultKind | null {
  if (typeof name !== "string") return null;
  if (/feedback|reply|outcome|details/.test(name)) return "feedback";
  if (/theme|taxonomy|category/.test(name)) return "theme";
  if (/application|posting|program/.test(name)) return "application";
  if (/source|discovery/.test(name)) return "source";
  return null;
}

function approvalTitle(
  name: unknown,
  kind: ResultKind | null,
  locale: Locale,
): string {
  if (typeof name !== "string")
    return locale === "fr" ? "Examiner l’action" : "Review action";
  const titles: Record<string, [string, string]> = {
    create_feedback: ["Submit feedback", "Envoyer un signalement"],
    submit_application: ["Submit application", "Envoyer la candidature"],
    submit_program_application: [
      "Submit program application",
      "Envoyer la demande",
    ],
    staff_assign_feedback: ["Assign feedback", "Attribuer le signalement"],
    staff_request_feedback_details: [
      "Request details",
      "Demander des précisions",
    ],
    staff_record_feedback_outcome: ["Record outcome", "Consigner le résultat"],
  };
  const known = titles[name];
  if (known) return known[locale === "fr" ? 1 : 0];
  if (kind === "theme")
    return locale === "fr" ? "Mettre à jour le thème" : "Update theme";
  if (kind === "feedback")
    return locale === "fr" ? "Mettre à jour le signalement" : "Update feedback";
  if (kind === "application")
    return locale === "fr"
      ? "Mettre à jour la candidature"
      : "Update application";
  return locale === "fr" ? "Examiner l’action" : "Review action";
}

function approvalSummary(
  preview: ApprovalPreview,
  kind: ResultKind | null,
): string | null {
  if (preview.name === "create_feedback") return null;
  const body = record(preview.body);
  if (!body) return null;
  if (kind === "application" || kind === "posting")
    return short(string(body.title) ?? string(body.postingTitle));
  if (kind === "theme") return short(string(body.summary));
  if (kind === "feedback")
    return short(string(body.message) ?? string(body.summary));
  return null;
}

function short(value: string | null): string | null {
  return value && value.length > 160
    ? `${value.slice(0, 159).trimEnd()}…`
    : value;
}

function fallback(value: unknown, locale: Locale): HTMLElement {
  const details = element("details", "agent-result-fallback");
  details.append(
    element(
      "summary",
      "",
      locale === "fr" ? "Afficher le résultat" : "View result",
    ),
  );
  const pre = element("pre", "", safeJson(value));
  details.append(pre);
  return details;
}

function errorResult(
  data: RecordValue,
  status: number,
  locale: Locale,
): HTMLElement {
  const card = element("section", "agent-result agent-result-error");
  card.append(
    element(
      "strong",
      "",
      locale === "fr" ? "Résultat indisponible" : "Result unavailable",
    ),
    element("p", "", string(record(data.error)?.message) ?? `${status}`),
  );
  return card;
}

function parse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function localized(value: unknown, locale: Locale): string | null {
  const translated = record(value);
  return translated
    ? (string(translated[locale]) ?? string(translated.en))
    : string(value);
}

function safeUrl(value: unknown): string | null {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(
      parse(value),
      (key, item) =>
        /token|authorization|secret/i.test(key) ? "[private]" : item,
      2,
    ).slice(0, 12_000);
  } catch {
    return "";
  }
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function label(kind: ResultKind, locale: Locale): string {
  const labels: Record<ResultKind, [string, string]> = {
    source: ["Sources", "Sources"],
    theme: ["Themes", "Thèmes"],
    posting: ["Postings", "Offres"],
    application: ["Applications", "Candidatures"],
    feedback: ["Feedback", "Signalements"],
  };
  return labels[kind][locale === "fr" ? 1 : 0];
}

function countLabel(kind: ResultKind, count: number, locale: Locale): string {
  const singular: Record<ResultKind, [string, string]> = {
    source: ["source", "source"],
    theme: ["theme", "thème"],
    posting: ["posting", "offre"],
    application: ["application", "candidature"],
    feedback: ["feedback", "signalement"],
  };
  const unit =
    count === 1
      ? singular[kind][locale === "fr" ? 1 : 0]
      : label(kind, locale).toLocaleLowerCase(
          locale === "fr" ? "fr-CA" : "en-CA",
        );
  return `${count} ${unit}`;
}

function emptyLabel(kind: ResultKind, locale: Locale): string {
  return locale === "fr"
    ? `Aucun résultat pour ${label(kind, locale).toLocaleLowerCase("fr-CA")}.`
    : `No ${label(kind, locale).toLocaleLowerCase("en-CA")} found.`;
}
