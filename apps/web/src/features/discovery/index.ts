import type { Locale } from "@civicresolve/contracts/v1";
import "./styles.css";

export type DiscoveryArea =
  | "all"
  | "jobs"
  | "support"
  | "funding"
  | "nearby"
  | "participation"
  | "saved";

interface DiscoveryItem {
  id: string;
  origin: "official_external" | "participating_org" | "sample";
  title: string;
  summary: string;
  publisher: string;
  sourceUrl: string;
  evidenceUrl: string | null;
  termsUrl: string | null;
  licence: { name: string | null; url: string | null };
  jurisdiction: { name: string; code: string };
  language: "en" | "fr" | "und";
  freshness: "current" | "stale" | "expired" | "error" | "unknown";
  verifiedAt: string | null;
  expiresAt: string | null;
  sampleLabel: string | null;
  area: Exclude<DiscoveryArea, "all" | "saved"> | null;
  handoff: {
    url: string;
    publisher: string;
    verifyOnPublisherSite: true;
    externalSubmissionRecorded: false;
  } | null;
}

interface ChecklistEntry {
  id: string;
  text: string;
  done: boolean;
}

interface SavedItem {
  item: DiscoveryItem;
  checklist: ChecklistEntry[];
  savedAt: string;
  updatedAt: string;
}

interface Options {
  area: DiscoveryArea;
  locale: Locale;
  token: string | null;
}

const API = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

const copy = {
  en: {
    search: "Search",
    searchPlaceholder: "Search official sources",
    jurisdiction: "Jurisdiction",
    allJurisdictions: "All jurisdictions",
    currentOnly: "Current only",
    practice: "Show practice records",
    noResults: "No matching records from reviewed sources yet.",
    noSaved: "Nothing saved yet.",
    loading: "Loading sources…",
    source: "Source",
    evidence: "Evidence",
    terms: "Terms",
    licence: "Licence",
    verified: "Reviewed",
    freshness: "Freshness",
    unknown: "Unknown",
    official: "Open official site",
    officialNote:
      "Check current details and complete any action on the publisher’s site. Envoy does not record external submissions.",
    noHandoff: "No verified official destination is available for this record.",
    back: "Back to results",
    save: "Save",
    saved: "Saved",
    remove: "Remove",
    signIn: "Sign in as an applicant to save this item and keep a checklist.",
    checklist: "Checklist",
    addStep: "Add step",
    stepPlaceholder: "Add a step for yourself",
    practiceLabel: "Practice record",
    practiceNote:
      "This is a practice record. It is not a live opportunity or service.",
    staleNote: "This source may have changed. Check the publisher’s site.",
    retry: "Retry",
    more: "Load more",
    reset: "Clear",
    area: "Area",
    publisher: "Publisher",
    language: "Language",
    resultCount: "results",
    all: "All",
    jobs: "Jobs",
    support: "Support",
    funding: "Funding",
    nearby: "Nearby",
    participation: "Participation",
    savedArea: "Saved",
  },
  fr: {
    search: "Rechercher",
    searchPlaceholder: "Rechercher dans les sources officielles",
    jurisdiction: "Territoire",
    allJurisdictions: "Tous les territoires",
    currentOnly: "Actuels seulement",
    practice: "Afficher les dossiers d’exercice",
    noResults:
      "Aucun dossier correspondant des sources examinées pour le moment.",
    noSaved: "Aucun élément enregistré.",
    loading: "Chargement des sources…",
    source: "Source",
    evidence: "Preuve",
    terms: "Conditions",
    licence: "Licence",
    verified: "Examiné",
    freshness: "Actualité",
    unknown: "Inconnue",
    official: "Ouvrir le site officiel",
    officialNote:
      "Vérifiez les détails actuels et effectuez toute démarche sur le site de l’éditeur. Envoy n’enregistre pas les soumissions externes.",
    noHandoff:
      "Aucune destination officielle vérifiée n’est disponible pour ce dossier.",
    back: "Retour aux résultats",
    save: "Enregistrer",
    saved: "Enregistré",
    remove: "Retirer",
    signIn:
      "Connectez-vous comme candidat pour enregistrer cet élément et tenir une liste.",
    checklist: "Liste de contrôle",
    addStep: "Ajouter une étape",
    stepPlaceholder: "Ajoutez une étape pour vous-même",
    practiceLabel: "Dossier d’exercice",
    practiceNote:
      "Il s’agit d’un dossier d’exercice, pas d’une offre ou d’un service actif.",
    staleNote:
      "Cette source a peut-être changé. Vérifiez le site de l’éditeur.",
    retry: "Réessayer",
    more: "Charger davantage",
    reset: "Effacer",
    area: "Domaine",
    publisher: "Éditeur",
    language: "Langue",
    resultCount: "résultats",
    all: "Tout",
    jobs: "Emplois",
    support: "Aide",
    funding: "Financement",
    nearby: "À proximité",
    participation: "Participation",
    savedArea: "Enregistrés",
  },
} as const;

export function createDiscoveryPage({
  area,
  locale,
  token,
}: Options): HTMLElement {
  const text = copy[locale];
  const root = node("section", "discovery-page");
  let query = "";
  let jurisdiction = "";
  let currentOnly = false;
  let includeSamples = false;
  let offset = 0;
  let total = 0;
  let records: DiscoveryItem[] = [];
  let saved: SavedItem[] = [];
  let selected: DiscoveryItem | null = null;
  let loading = false;
  let error = "";
  let notice = "";

  const refresh = async (append = false): Promise<void> => {
    loading = true;
    error = "";
    render();
    try {
      if (area === "saved") {
        if (!token) {
          saved = [];
        } else {
          const result = await request<{ items: SavedItem[] }>(
            `/discovery/saved?includeSamples=${includeSamples}`,
            token,
          );
          saved = result.items;
        }
      } else {
        const params = new URLSearchParams({
          limit: "30",
          offset: String(offset),
        });
        if (area !== "all") params.set("area", area);
        if (query) params.set("q", query);
        if (jurisdiction) params.set("jurisdiction", jurisdiction);
        if (currentOnly) params.set("freshness", "current");
        if (includeSamples) params.set("includeSamples", "true");
        const result = await request<{ items: DiscoveryItem[]; total: number }>(
          `/discovery?${params}`,
        );
        records = append ? records.concat(result.items) : result.items;
        total = result.total;
        if (token) {
          const savedResult = await request<{ items: SavedItem[] }>(
            `/discovery/saved?includeSamples=${includeSamples}`,
            token,
          );
          saved = savedResult.items;
        }
      }
    } catch (cause) {
      error = message(cause);
    } finally {
      loading = false;
      render();
    }
  };

  function render(): void {
    root.replaceChildren();
    if (selected) {
      const heading = node("div", "discovery-heading");
      heading.append(
        action(text.back, "discovery-link", () => {
          selected = null;
          notice = "";
          render();
        }),
      );
      root.append(heading, detail(selected));
      return;
    }
    if (area !== "saved") root.append(filters());
    else if (!token) root.append(node("p", "discovery-muted", text.signIn));
    const practice = node("label", "discovery-check");
    const practiceInput = document.createElement("input");
    practiceInput.type = "checkbox";
    practiceInput.checked = includeSamples;
    practiceInput.addEventListener("change", () => {
      includeSamples = practiceInput.checked;
      offset = 0;
      void refresh();
    });
    practice.append(practiceInput, node("span", "", text.practice));
    root.append(practice);
    if (notice) root.append(node("p", "discovery-notice", notice));
    if (error) {
      const alert = node("div", "discovery-alert");
      alert.append(
        node("span", "", error),
        action(text.retry, "discovery-button", () => void refresh()),
      );
      root.append(alert);
    }
    if (loading && !records.length && !saved.length)
      root.append(node("p", "discovery-muted", text.loading));
    const list = node("div", "discovery-list");
    const displayed =
      area === "saved" ? saved.map((entry) => entry.item) : records;
    for (const item of displayed) list.append(row(item));
    root.append(list);
    if (!loading && !error && displayed.length === 0)
      root.append(
        node(
          "p",
          "discovery-empty",
          area === "saved" ? text.noSaved : text.noResults,
        ),
      );
    if (area !== "saved" && records.length < total) {
      root.append(
        action(text.more, "discovery-button", () => {
          offset += 30;
          void refresh(true);
        }),
      );
    }
  }

  function filters(): HTMLElement {
    const form = node("form", "discovery-filters");
    const search = document.createElement("input");
    search.className = "discovery-input";
    search.type = "search";
    search.maxLength = 120;
    search.placeholder = text.searchPlaceholder;
    search.setAttribute("aria-label", text.search);
    search.value = query;
    search.addEventListener("input", () => {
      query = search.value;
    });
    const region = document.createElement("select");
    region.className = "discovery-select";
    region.setAttribute("aria-label", text.jurisdiction);
    for (const [value, label] of [
      ["", text.allJurisdictions],
      ["CA", "Canada"],
      ["CA-ON", "Ontario"],
      ["CA-BC", "British Columbia"],
    ] as Array<[string, string]>) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === jurisdiction;
      region.append(option);
    }
    region.addEventListener("change", () => {
      jurisdiction = region.value;
    });
    const current = node("label", "discovery-check");
    const currentInput = document.createElement("input");
    currentInput.type = "checkbox";
    currentInput.checked = currentOnly;
    currentInput.addEventListener("change", () => {
      currentOnly = currentInput.checked;
      offset = 0;
      void refresh();
    });
    current.append(currentInput, node("span", "", text.currentOnly));
    const submit = action(
      text.search,
      "discovery-button discovery-button-primary",
    );
    submit.type = "submit";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      offset = 0;
      void refresh();
    });
    form.append(search, region, current, submit);
    return form;
  }

  function row(item: DiscoveryItem): HTMLElement {
    const entry = node("article", "discovery-row");
    const title = action(item.title, "discovery-row-title", () => {
      selected = item;
      notice = "";
      render();
    });
    entry.append(title, node("p", "discovery-summary", item.summary));
    const meta = node("div", "discovery-meta");
    meta.append(
      node("span", "", item.publisher),
      node("span", "", item.jurisdiction.name),
    );
    if (item.area) meta.append(node("span", "", text[item.area]));
    if (item.origin === "sample")
      meta.append(node("span", "discovery-practice", text.practiceLabel));
    else if (item.freshness !== "current")
      meta.append(node("span", "", item.freshness));
    entry.append(meta);
    return entry;
  }

  function detail(item: DiscoveryItem): HTMLElement {
    const view = node("article", "discovery-detail");
    view.append(
      node("h3", "", item.title),
      node("p", "discovery-summary", item.summary),
    );
    if (item.origin === "sample")
      view.append(node("p", "discovery-notice", text.practiceNote));
    if (item.freshness !== "current")
      view.append(node("p", "discovery-muted", text.staleNote));
    const facts = node("dl", "discovery-facts");
    for (const [label, value] of [
      [text.area, item.area ? text[item.area] : text.unknown],
      [text.publisher, item.publisher],
      [text.jurisdiction, item.jurisdiction.name],
      [text.freshness, item.freshness],
      [
        text.verified,
        item.verifiedAt
          ? new Date(item.verifiedAt).toLocaleDateString(locale)
          : text.unknown,
      ],
      [text.language, item.language.toUpperCase()],
    ])
      facts.append(node("dt", "", label), node("dd", "", value));
    view.append(facts);
    const provenance = node("div", "discovery-provenance");
    for (const [label, url] of [
      [text.evidence, item.evidenceUrl],
      [text.terms, item.termsUrl],
      [item.licence.name ?? text.licence, item.licence.url],
    ] as Array<[string, string | null]>) {
      if (!url || !isHttps(url)) continue;
      const link = node("a", "discovery-link", label);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      provenance.append(link);
    }
    if (provenance.childElementCount) view.append(provenance);
    if (notice) view.append(node("p", "discovery-notice", notice));
    const actions = node("div", "discovery-actions");
    if (item.handoff) {
      actions.append(
        action(
          text.official,
          "discovery-button discovery-button-primary",
          () => void openOfficial(item),
        ),
      );
      view.append(node("p", "discovery-muted", text.officialNote));
    } else view.append(node("p", "discovery-muted", text.noHandoff));
    if (token) {
      const wasSaved = saved.some((entry) => entry.item.id === item.id);
      actions.append(
        action(
          wasSaved ? text.remove : text.save,
          "discovery-button",
          () => void toggleSave(item, wasSaved),
        ),
      );
    } else view.append(node("p", "discovery-muted", text.signIn));
    view.append(actions);
    const savedEntry = saved.find((entry) => entry.item.id === item.id);
    if (savedEntry) view.append(checklist(item, savedEntry.checklist));
    return view;
  }

  function checklist(
    item: DiscoveryItem,
    entries: ChecklistEntry[],
  ): HTMLElement {
    const section = node("section", "discovery-checklist");
    section.append(node("h4", "", text.checklist));
    for (const entry of entries) {
      const line = node("div", "discovery-step");
      const label = node("label", "discovery-check");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = entry.done;
      checkbox.addEventListener(
        "change",
        () =>
          void saveChecklist(
            item,
            entries.map((part) =>
              part.id === entry.id ? { ...part, done: checkbox.checked } : part,
            ),
          ),
      );
      label.append(checkbox, node("span", "", entry.text));
      line.append(
        label,
        action(
          text.remove,
          "discovery-step-remove",
          () =>
            void saveChecklist(
              item,
              entries.filter((part) => part.id !== entry.id),
            ),
        ),
      );
      section.append(line);
    }
    if (entries.length < 12) {
      const form = node("form", "discovery-step-form");
      const input = document.createElement("input");
      input.className = "discovery-input";
      input.maxLength = 140;
      input.placeholder = text.stepPlaceholder;
      input.setAttribute("aria-label", text.stepPlaceholder);
      const add = action(text.addStep, "discovery-button");
      add.type = "submit";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (input.value.trim())
          void saveChecklist(item, [
            ...entries,
            {
              id: crypto.randomUUID().replaceAll("-", "").slice(0, 32),
              text: input.value.trim(),
              done: false,
            },
          ]);
      });
      form.append(input, add);
      section.append(form);
    }
    return section;
  }

  async function openOfficial(item: DiscoveryItem): Promise<void> {
    const opened = window.open("", "_blank");
    try {
      const result = await request<{
        handoff: { url: string };
        externalSubmissionRecorded: false;
      }>(`/discovery/${encodeURIComponent(item.id)}/handoff`, undefined);
      const url = new URL(result.handoff.url);
      if (url.protocol !== "https:") throw new Error(text.noHandoff);
      if (opened) {
        opened.opener = null;
        opened.location.replace(url.toString());
      } else {
        window.location.assign(url.toString());
      }
    } catch (cause) {
      opened?.close();
      notice = message(cause);
      render();
    }
  }

  async function toggleSave(
    item: DiscoveryItem,
    wasSaved: boolean,
  ): Promise<void> {
    if (!token) return;
    try {
      if (wasSaved) {
        await request(
          `/discovery/saved/${encodeURIComponent(item.id)}`,
          token,
          "DELETE",
        );
        saved = saved.filter((entry) => entry.item.id !== item.id);
      } else {
        const result = await request<{ checklist: ChecklistEntry[] }>(
          `/discovery/saved/${encodeURIComponent(item.id)}?includeSamples=${includeSamples}`,
          token,
          "PUT",
          {},
        );
        saved.push({
          item,
          checklist: result.checklist,
          savedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      render();
    } catch (cause) {
      notice = message(cause);
      render();
    }
  }

  async function saveChecklist(
    item: DiscoveryItem,
    checklist: ChecklistEntry[],
  ): Promise<void> {
    if (!token) return;
    try {
      await request(
        `/discovery/saved/${encodeURIComponent(item.id)}?includeSamples=${includeSamples}`,
        token,
        "PUT",
        { checklist },
      );
      saved = saved.map((entry) =>
        entry.item.id === item.id ? { ...entry, checklist } : entry,
      );
      render();
    } catch (cause) {
      notice = message(cause);
      render();
    }
  }

  void refresh();
  return root;
}

async function request<T>(
  path: string,
  token?: string | null,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? `Request failed (${response.status})`,
    );
  if (!payload) throw new Error("Invalid response");
  return payload;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function action(
  label: string,
  className: string,
  handler?: () => void,
): HTMLButtonElement {
  const button = node("button", className, label);
  button.type = "button";
  if (handler) button.addEventListener("click", handler);
  return button;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
