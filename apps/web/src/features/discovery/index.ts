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
  type:
    | "jobs_finder"
    | "benefits_finder"
    | "funding_finder"
    | "service_location"
    | "consultation_finder"
    | "source_record"
    | "sample_record";
  title: string;
  summary: string;
  publisher: string;
  sourceUrl: string;
  evidenceUrl: string | null;
  termsUrl: string | null;
  licence: { name: string | null; url: string | null };
  jurisdiction: { name: string; code: string };
  coordinates: { latitude: number; longitude: number } | null;
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
    keywords: "Keywords",
    searchPlaceholder: "Role, program, or service",
    location: "City or location",
    locationPlaceholder: "City, province, or Canada",
    filters: "Filters",
    results: "Results",
    finder: "Official finder",
    verifiedListing: "Verified listing",
    locationRecord: "Service location",
    consultationFinder: "Consultation finder",
    sourceRecord: "Official source",
    chooseResult: "Choose a result to view details.",
    list: "List",
    map: "Map",
    mapNote:
      "Positions come from official source coordinates. This is a schematic map.",
    mapUnavailable: "No verified coordinates are available for these results.",
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
    keywords: "Mots-clés",
    searchPlaceholder: "Poste, programme ou service",
    location: "Ville ou lieu",
    locationPlaceholder: "Ville, province ou Canada",
    filters: "Filtres",
    results: "Résultats",
    finder: "Moteur de recherche officiel",
    verifiedListing: "Annonce vérifiée",
    locationRecord: "Point de service",
    consultationFinder: "Recherche de consultations",
    sourceRecord: "Source officielle",
    chooseResult: "Choisissez un résultat pour voir les détails.",
    list: "Liste",
    map: "Carte",
    mapNote:
      "Les positions viennent des coordonnées de la source officielle. Cette carte est schématique.",
    mapUnavailable:
      "Aucune coordonnée vérifiée n’est disponible pour ces résultats.",
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
  let queryDraft = "";
  let location = "";
  let locationDraft = "";
  let currentOnly = false;
  let includeSamples = false;
  let display: "list" | "map" = "list";
  let mobileDetail = false;
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
        if (location) params.set("location", location);
        if (currentOnly) params.set("freshness", "current");
        if (includeSamples) params.set("includeSamples", "true");
        const result = await request<{ items: DiscoveryItem[]; total: number }>(
          `/discovery?${params}`,
        );
        records = append ? records.concat(result.items) : result.items;
        total = result.total;
        if (!append && !records.some((item) => item.id === selected?.id)) {
          selected = records[0] ?? null;
          mobileDetail = false;
        }
        if (token) {
          const savedResult = await request<{ items: SavedItem[] }>(
            `/discovery/saved?includeSamples=${includeSamples}`,
            token,
          ).catch(() => null);
          if (savedResult) saved = savedResult.items;
        }
      }
      if (
        area === "saved" &&
        !saved.some((entry) => entry.item.id === selected?.id)
      ) {
        selected = saved[0]?.item ?? null;
        mobileDetail = false;
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
    if (area !== "saved") root.append(filters());
    const tools = node("div", "discovery-toolbar");
    const displayed =
      area === "saved" ? saved.map((entry) => entry.item) : records;
    tools.append(
      node(
        "strong",
        "discovery-result-count",
        `${area === "saved" ? displayed.length : total} ${text.resultCount}`,
      ),
    );
    const practice = node("label", "discovery-check");
    const practiceInput = document.createElement("input");
    practiceInput.type = "checkbox";
    practiceInput.checked = includeSamples;
    practiceInput.addEventListener("change", () => {
      includeSamples = practiceInput.checked;
      query = queryDraft.trim();
      location = locationDraft.trim();
      offset = 0;
      void refresh();
    });
    practice.append(practiceInput, node("span", "", text.practice));
    tools.append(practice);
    if (area === "nearby" && displayed.some((item) => item.coordinates)) {
      const switcher = node("div", "discovery-view-switch");
      for (const mode of ["list", "map"] as const) {
        const choice = action(
          text[mode],
          display === mode ? "is-active" : "",
          () => {
            display = mode;
            mobileDetail = false;
            render();
          },
        );
        choice.setAttribute("aria-pressed", String(display === mode));
        switcher.append(choice);
      }
      tools.append(switcher);
    }
    root.append(tools);
    if (area === "saved" && !token)
      root.append(node("p", "discovery-muted", text.signIn));
    if (error) {
      const alert = node("div", "discovery-alert");
      alert.append(
        node("span", "", error),
        action(text.retry, "discovery-button", () => void refresh()),
      );
      root.append(alert);
    }
    const workspace = node(
      "div",
      `discovery-workspace ${mobileDetail ? "is-detail-open" : ""} ${selected ? "" : "is-empty"}`,
    );
    const results = node("section", "discovery-results");
    if (loading && !displayed.length)
      results.append(node("p", "discovery-empty", text.loading));
    else if (!error && !displayed.length)
      results.append(
        node(
          "p",
          "discovery-empty",
          area === "saved" ? text.noSaved : text.noResults,
        ),
      );
    else if (display === "map" && area === "nearby")
      results.append(map(displayed));
    else {
      for (const item of displayed) results.append(row(item));
      if (area !== "saved" && records.length < total) {
        results.append(
          action(text.more, "discovery-button discovery-more", () => {
            offset += 30;
            void refresh(true);
          }),
        );
      }
    }
    const panel = node("section", "discovery-detail-panel");
    panel.append(
      selected
        ? detail(selected)
        : node("p", "discovery-empty", text.chooseResult),
    );
    workspace.append(results, panel);
    root.append(workspace);
  }

  function filters(): HTMLElement {
    const form = node("form", "discovery-search");
    const fields = node("div", "discovery-search-fields");
    const keywordField = node("label", "discovery-search-field");
    keywordField.append(node("span", "", text.keywords));
    const search = document.createElement("input");
    search.className = "discovery-input";
    search.type = "search";
    search.maxLength = 120;
    search.placeholder = text.searchPlaceholder;
    search.value = queryDraft;
    search.addEventListener("input", () => {
      queryDraft = search.value;
    });
    keywordField.append(search);
    const locationField = node("label", "discovery-search-field");
    locationField.append(node("span", "", text.location));
    const place = document.createElement("input");
    place.className = "discovery-input";
    place.type = "search";
    place.maxLength = 80;
    place.placeholder = text.locationPlaceholder;
    place.value = locationDraft;
    place.addEventListener("input", () => {
      locationDraft = place.value;
    });
    locationField.append(place);
    fields.append(keywordField, locationField);
    const current = node("label", "discovery-check");
    const currentInput = document.createElement("input");
    currentInput.type = "checkbox";
    currentInput.checked = currentOnly;
    currentInput.addEventListener("change", () => {
      currentOnly = currentInput.checked;
      query = queryDraft.trim();
      location = locationDraft.trim();
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
      query = queryDraft.trim();
      location = locationDraft.trim();
      offset = 0;
      mobileDetail = false;
      void refresh();
    });
    const bottom = node("div", "discovery-search-actions");
    bottom.append(current, submit);
    form.append(fields, bottom);
    return form;
  }

  function row(item: DiscoveryItem): HTMLElement {
    const entry = node(
      "article",
      `discovery-row ${selected?.id === item.id ? "is-selected" : ""}`,
    );
    entry.append(node("span", "discovery-type", itemType(item)));
    const title = action(item.title, "discovery-row-title", () => {
      selected = item;
      mobileDetail = true;
      notice = "";
      render();
    });
    const compactSummary =
      item.type === "service_location"
        ? item.summary
            .replace(/^Service BC office at /, "")
            .replace(/\. Confirm hours.*$/i, "")
        : item.summary;
    entry.append(title, node("p", "discovery-summary", compactSummary));
    const meta = node("div", "discovery-meta");
    meta.append(
      node("span", "", item.publisher),
      node("span", "", item.jurisdiction.name),
    );
    if (item.origin === "sample")
      meta.append(node("span", "discovery-practice", text.practiceLabel));
    else if (item.freshness !== "current")
      meta.append(node("span", "", item.freshness));
    entry.append(meta);
    return entry;
  }

  function map(items: DiscoveryItem[]): HTMLElement {
    const points = items.filter(
      (
        item,
      ): item is DiscoveryItem & {
        coordinates: { latitude: number; longitude: number };
      } => !!item.coordinates && item.origin !== "sample",
    );
    if (!points.length)
      return node("p", "discovery-empty", text.mapUnavailable);
    const latitudes = points.map((item) => item.coordinates.latitude);
    const longitudes = points.map((item) => item.coordinates.longitude);
    const minLat = Math.min(...latitudes) - 0.3;
    const maxLat = Math.max(...latitudes) + 0.3;
    const minLon = Math.min(...longitudes) - 0.3;
    const maxLon = Math.max(...longitudes) + 0.3;
    const view = node("div", "discovery-map");
    view.append(node("span", "discovery-map-north", "N"));
    for (const item of points) {
      const marker = action(item.title, "discovery-map-pin", () => {
        selected = item;
        mobileDetail = true;
        render();
      });
      marker.textContent = "";
      marker.setAttribute("aria-label", item.title);
      marker.title = item.title;
      marker.style.left = `${7 + ((item.coordinates.longitude - minLon) / (maxLon - minLon)) * 86}%`;
      marker.style.top = `${7 + (1 - (item.coordinates.latitude - minLat) / (maxLat - minLat)) * 86}%`;
      if (selected?.id === item.id) marker.classList.add("is-selected");
      view.append(marker);
    }
    const container = node("div", "discovery-map-wrap");
    container.append(view, node("p", "discovery-muted", text.mapNote));
    return container;
  }

  function itemType(item: DiscoveryItem): string {
    if (item.origin === "sample") return text.practiceLabel;
    if (item.origin === "participating_org") return text.verifiedListing;
    if (item.type === "service_location") return text.locationRecord;
    if (item.type === "consultation_finder") return text.consultationFinder;
    if (item.type.endsWith("_finder")) return text.finder;
    return text.sourceRecord;
  }

  function detail(item: DiscoveryItem): HTMLElement {
    const view = node("article", "discovery-detail");
    view.append(
      action(text.back, "discovery-back discovery-link", () => {
        mobileDetail = false;
        render();
      }),
    );
    view.append(
      node("span", "discovery-type", itemType(item)),
      node("h3", "", item.title),
      node(
        "p",
        "discovery-detail-publisher",
        `${item.publisher} · ${item.jurisdiction.name}`,
      ),
      node("p", "discovery-summary", item.summary),
    );
    if (item.origin === "sample")
      view.append(node("p", "discovery-notice", text.practiceNote));
    if (item.freshness !== "current")
      view.append(node("p", "discovery-muted", text.staleNote));
    const actions = node("div", "discovery-actions");
    if (item.handoff) {
      actions.append(
        action(
          text.official,
          "discovery-button discovery-button-primary",
          () => void openOfficial(item),
        ),
      );
    }
    if (token) {
      const wasSaved = saved.some((entry) => entry.item.id === item.id);
      actions.append(
        action(
          wasSaved ? text.remove : text.save,
          "discovery-button",
          () => void toggleSave(item, wasSaved),
        ),
      );
    }
    view.append(actions);
    if (item.handoff)
      view.append(node("p", "discovery-muted", text.officialNote));
    else view.append(node("p", "discovery-muted", text.noHandoff));
    if (!token) view.append(node("p", "discovery-muted", text.signIn));
    if (notice) view.append(node("p", "discovery-notice", notice));
    const facts = node("dl", "discovery-facts");
    for (const [label, value] of [
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
        if (area === "saved") {
          selected = saved[0]?.item ?? null;
          mobileDetail = false;
        }
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
