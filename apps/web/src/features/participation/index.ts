import type { Locale } from "@civicresolve/contracts/v1";
import { ArrowUpRight, CalendarDays, ExternalLink, RefreshCw } from "lucide-static";
import "./styles.css";

interface Consultation {
  id: string;
  kind: "consultation" | "directory";
  title: string;
  summary: string;
  publisher: string;
  jurisdiction: { code: "CA" | "CA-BC" | "CA-ON"; name: string };
  deadlineDate: string | null;
  officialUrl: string;
  sourceState: "current" | "stale" | "error";
  verifiedAt: string;
  participationStatus: "open" | "closed" | "directory" | "check_official_source";
}

interface Options {
  locale: Locale;
  token: string | null;
  onPrepare?: (recordId: string) => void;
}

const API = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

const copy = {
  en: {
    heading: "Have your say",
    intro: "Public decisions you can help shape.",
    all: "All",
    canada: "Canada",
    bc: "British Columbia",
    ontario: "Ontario",
    upcoming: "Open for input",
    review: "Check on official site",
    closed: "Past deadlines",
    directories: "Explore more opportunities",
    directory: "Official directory",
    closing: "Deadline",
    open: "Open consultation",
    browse: "Browse directory",
    checked: "Source checked",
    handoff: "Participation continues on the official site.",
    noSubmission: "Envoy does not submit a response for you.",
    noDate: "See official site for dates",
    loading: "Loading participation opportunities…",
    unavailable: "Participation opportunities are unavailable right now.",
    retry: "Try again",
    empty: "No participation opportunities in this area yet.",
    openStatus: "Open",
    reviewStatus: "Verify status",
    closedStatus: "Deadline passed",
  },
  fr: {
    heading: "Donnez votre avis",
    intro: "Participez aux décisions publiques.",
    all: "Tout",
    canada: "Canada",
    bc: "Colombie-Britannique",
    ontario: "Ontario",
    upcoming: "Consultations ouvertes",
    review: "Vérifier sur le site officiel",
    closed: "Dates limites passées",
    directories: "Explorer d’autres possibilités",
    directory: "Répertoire officiel",
    closing: "Date limite",
    open: "Ouvrir la consultation",
    browse: "Parcourir le répertoire",
    checked: "Source vérifiée",
    handoff: "La participation se poursuit sur le site officiel.",
    noSubmission: "Envoy ne soumet pas de réponse pour vous.",
    noDate: "Voir les dates sur le site officiel",
    loading: "Chargement des consultations…",
    unavailable: "Les consultations sont temporairement indisponibles.",
    retry: "Réessayer",
    empty: "Aucune consultation dans cette région pour le moment.",
    openStatus: "Ouverte",
    reviewStatus: "Vérifier le statut",
    closedStatus: "Date limite passée",
  },
} as const;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.className = className;
  result.append(...children);
  return result;
}

function icon(svg: string): HTMLSpanElement {
  const result = element("span", "participation-icon");
  result.setAttribute("aria-hidden", "true");
  result.innerHTML = svg;
  return result;
}

function officialLink(item: Consultation, label: string, className: string): HTMLAnchorElement {
  const link = element("a", className, label, icon(ArrowUpRight));
  const destination = new URL(item.officialUrl);
  link.href = destination.protocol === "https:" ? destination.href : "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function dateParts(date: string | null, locale: Locale): { day: string; month: string; full: string } {
  if (!date) return { day: "—", month: "", full: "" };
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime())) return { day: "—", month: "", full: "" };
  const region = locale === "fr" ? "fr-CA" : "en-CA";
  return {
    day: new Intl.DateTimeFormat(region, { day: "2-digit", timeZone: "UTC" }).format(value),
    month: new Intl.DateTimeFormat(region, { month: "short", timeZone: "UTC" }).format(value),
    full: new Intl.DateTimeFormat(region, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value),
  };
}

function checkedDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    month: "short", day: "numeric", year: "numeric",
  }).format(date);
}

export function createParticipationPage({ locale }: Options): HTMLElement {
  const text = copy[locale];
  const root = element("section", "participation-page");
  let records: Consultation[] = [];
  let jurisdiction: Consultation["jurisdiction"]["code"] | "all" = "all";
  let loading = true;
  let error = false;

  function consultationCard(item: Consultation, featured = false): HTMLElement {
    const date = dateParts(item.deadlineDate, locale);
    const status = item.participationStatus;
    const row = element("article", `participation-opportunity ${featured ? "is-featured" : ""}`);
    const dateBlock = element("div", "participation-date");
    dateBlock.append(
      element("span", "participation-date-month", date.month),
      element("strong", "participation-date-day", date.day),
      element("span", "participation-date-caption", text.closing),
    );
    const content = element("div", "participation-opportunity-body");
    const statusName = status === "open" ? text.openStatus : status === "closed" ? text.closedStatus : text.reviewStatus;
    const meta = element("div", "participation-meta",
      element("span", "participation-jurisdiction", item.jurisdiction.name),
      element("span", `participation-status participation-status-${status}`, statusName),
    );
    const title = element("h3", "participation-opportunity-title", item.title);
    const summary = element("p", "participation-summary", item.summary);
    const byline = element("div", "participation-byline", item.publisher);
    if (date.full) byline.append(element("span", "participation-separator", "·"), element("span", "", date.full));
    content.append(meta, title, summary, byline);
    const action = officialLink(item, text.open, "participation-action");
    row.append(dateBlock, content, action);
    return row;
  }

  function directoryCard(item: Consultation): HTMLElement {
    const card = element("article", "participation-directory-card");
    card.append(
      element("span", "participation-directory-type", icon(ExternalLink), text.directory),
      element("h3", "participation-directory-title", item.title),
      element("p", "participation-directory-publisher", item.jurisdiction.name),
      officialLink(item, text.browse, "participation-directory-link"),
    );
    return card;
  }

  function render(): void {
    root.replaceChildren();
    const header = element("div", "participation-heading");
    header.append(
      element("div", "", element("h2", "participation-title", text.heading), element("p", "participation-intro", text.intro)),
      element("div", "participation-count", icon(CalendarDays), `${records.filter((record) => record.kind === "consultation" && record.participationStatus === "open" && (jurisdiction === "all" || record.jurisdiction.code === jurisdiction)).length} ${text.upcoming}`),
    );
    root.append(header);

    const filters = element("div", "participation-filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", locale === "fr" ? "Région" : "Region");
    const choices: Array<[typeof jurisdiction, string]> = [
      ["all", text.all], ["CA", text.canada], ["CA-BC", text.bc], ["CA-ON", text.ontario],
    ];
    for (const [value, label] of choices) {
      const button = element("button", `participation-filter ${jurisdiction === value ? "is-active" : ""}`, label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(jurisdiction === value));
      button.addEventListener("click", () => { jurisdiction = value; render(); });
      filters.append(button);
    }
    root.append(filters);

    if (loading) {
      const state = element("div", "participation-state", text.loading);
      state.setAttribute("role", "status");
      root.append(state);
      return;
    }
    if (error) {
      const state = element("div", "participation-state", text.unavailable);
      const retry = element("button", "participation-retry", icon(RefreshCw), text.retry);
      retry.type = "button";
      retry.addEventListener("click", () => void load());
      state.append(retry);
      root.append(state);
      return;
    }

    const filtered = records.filter((item) => jurisdiction === "all" || item.jurisdiction.code === jurisdiction);
    const current = filtered.filter((item) => item.kind === "consultation" && item.participationStatus === "open");
    const review = filtered.filter((item) => item.kind === "consultation" && item.participationStatus === "check_official_source");
    const closed = filtered.filter((item) => item.kind === "consultation" && item.participationStatus === "closed");
    const directories = filtered.filter((item) => item.kind === "directory");
    if (!filtered.length) root.append(element("p", "participation-state", text.empty));
    const sections: Array<[Consultation[], string]> = [[current, text.upcoming], [review, text.review], [closed, text.closed]];
    for (const [items, title] of sections) {
      if (!items.length) continue;
      const section = element("section", "participation-section");
      section.append(element("h3", "participation-section-title", title));
      const list = element("div", "participation-list");
      items.forEach((item, index) => list.append(consultationCard(item, items === current && index === 0)));
      section.append(list);
      root.append(section);
    }
    if (directories.length) {
      const section = element("section", "participation-section participation-directory-section");
      section.append(element("h3", "participation-section-title", text.directories));
      const grid = element("div", "participation-directory-grid");
      directories.forEach((item) => grid.append(directoryCard(item)));
      section.append(grid);
      root.append(section);
    }
    if (filtered.length) {
      const newest = filtered.map((item) => item.verifiedAt).sort().at(-1);
      root.append(element("p", "participation-footnote",
        `${text.handoff} ${text.noSubmission}${newest ? ` ${text.checked} ${checkedDate(newest, locale)}.` : ""}`,
      ));
    }
  }

  async function load(): Promise<void> {
    loading = true;
    error = false;
    render();
    try {
      const response = await fetch(`${API}/consultations`);
      if (!response.ok) throw new Error("consultations unavailable");
      const data = await response.json() as { consultations: Consultation[] };
      records = Array.isArray(data.consultations) ? data.consultations : [];
    } catch {
      error = true;
    } finally {
      loading = false;
      render();
    }
  }

  void load();
  return root;
}
