import type { Locale } from "@civicresolve/contracts/v1";
import { ArrowRight, ArrowUpRight, Search } from "lucide-static";
import { createProgramIntakePage } from "../program-intake/index.js";
import "./styles.css";

interface Options {
  view: "discover" | "mine" | "sponsor";
  locale: Locale;
  token: string | null;
  organizationId: string | null;
  onSignIn?: () => void;
  onPrepareExternal?: (recordId: string) => void;
}

interface OfficialProgram {
  id: string;
  title: string;
  summary: string;
  publisher: string;
  sourceUrl: string;
  freshness: string;
  jurisdiction: { name: string };
  area: string | null;
}

const base = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");
const h = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (svg: string) =>
  `<span class="pg-icon" aria-hidden="true">${svg}</span>`;
const copy = {
  en: {
    inApp: "Participating programs",
    official: "Official sources",
    support: "Support",
    funding: "Funding",
    search: "Search official sources",
    source: "Official finder",
    view: "View details",
    prepare: "Prepare in Envoy",
    publisher: "Publisher",
    current: "Current",
    stale: "Check current details",
    empty: "No official sources match.",
    loading: "Loading official sources…",
    error: "Official sources are unavailable right now.",
    retry: "Try again",
    notice:
      "Complete applications on the publisher’s site. Envoy does not record an external submission.",
  },
  fr: {
    inApp: "Programmes participants",
    official: "Sources officielles",
    support: "Soutien",
    funding: "Financement",
    search: "Rechercher des sources officielles",
    source: "Recherche officielle",
    view: "Voir les détails",
    prepare: "Préparer dans Envoy",
    publisher: "Éditeur",
    current: "À jour",
    stale: "Vérifiez les détails",
    empty: "Aucune source officielle correspondante.",
    loading: "Chargement des sources officielles…",
    error: "Les sources officielles sont indisponibles pour le moment.",
    retry: "Réessayer",
    notice:
      "Terminez les demandes sur le site de l’éditeur. Envoy n’enregistre aucune demande externe.",
  },
} as const;

export function createPublicProgramsPage(options: Options): HTMLElement {
  if (options.view !== "discover") return createProgramIntakePage(options);
  const text = copy[options.locale];
  const root = document.createElement("section");
  root.className = "public-programs";
  const intake = createProgramIntakePage(options);
  let tab: "inApp" | "official" = "inApp";
  let area: "support" | "funding" = "support";
  let records: OfficialProgram[] = [];
  let selected = "";
  let query = "";
  let loading = false;
  let error = "";

  async function load(): Promise<void> {
    loading = true;
    error = "";
    render();
    try {
      const response = await fetch(`${base}/discovery?area=${area}&limit=100`);
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { items?: OfficialProgram[] };
      records = (body.items ?? []).filter((item) =>
        item.sourceUrl.startsWith("https://"),
      );
      selected = records.some((item) => item.id === selected)
        ? selected
        : (records[0]?.id ?? "");
    } catch {
      error = text.error;
    } finally {
      loading = false;
      render();
    }
  }

  function render(): void {
    root.replaceChildren();
    const tabs = document.createElement("div");
    tabs.className = "pg-tabs";
    tabs.innerHTML = `<button class="${tab === "inApp" ? "active" : ""}" data-tab="inApp">${h(text.inApp)}</button><button class="${tab === "official" ? "active" : ""}" data-tab="official">${h(text.official)}</button>`;
    root.append(tabs);
    if (tab === "inApp") {
      root.append(intake);
      return;
    }
    const visible = records.filter((item) =>
      `${item.title} ${item.summary} ${item.publisher} ${item.jurisdiction.name}`
        .toLowerCase()
        .includes(query),
    );
    const active = visible.find((item) => item.id === selected) ?? visible[0];
    const panel = document.createElement("div");
    panel.className = "pg-official";
    panel.innerHTML = `<div class="pg-toolbar"><div class="pg-segments"><button data-area="support" class="${area === "support" ? "active" : ""}">${h(text.support)}</button><button data-area="funding" class="${area === "funding" ? "active" : ""}">${h(text.funding)}</button></div><label class="pg-search">${icon(Search)}<input id="pg-query" type="search" aria-label="${h(text.search)}" placeholder="${h(text.search)}" value="${h(query)}" /></label></div>${loading ? `<p class="pg-state">${h(text.loading)}</p>` : error ? `<p class="pg-state" role="alert">${h(error)} <button data-action="retry">${h(text.retry)}</button></p>` : `<div class="pg-split"><div class="pg-list">${visible.map((item) => `<button class="pg-row ${active?.id === item.id ? "selected" : ""}" data-record="${h(item.id)}"><span>${h(text.source)} · ${h(item.jurisdiction.name)}</span><strong>${h(item.title)}</strong><small>${h(item.publisher)}</small>${icon(ArrowRight)}</button>`).join("") || `<p class="pg-state">${h(text.empty)}</p>`}</div><article class="pg-detail">${active ? `<span class="pg-kicker">${h(text.source)}</span><h2>${h(active.title)}</h2><p>${h(active.summary)}</p><dl><div><dt>${h(text.publisher)}</dt><dd>${h(active.publisher)}</dd></div><div><dt>${h(text.current)}</dt><dd>${h(active.freshness === "current" ? text.current : text.stale)}</dd></div></dl><p class="pg-note">${h(text.notice)}</p><div class="pg-actions"><button class="pg-button primary" data-action="prepare" data-id="${h(active.id)}">${h(text.prepare)}${icon(ArrowRight)}</button><a class="pg-button" target="_blank" rel="noopener noreferrer" href="${h(active.sourceUrl)}">${h(text.official)}${icon(ArrowUpRight)}</a></div>` : `<p class="pg-state">${h(text.empty)}</p>`}</article></div>`}`;
    root.append(panel);
  }

  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-tab],[data-area],[data-record],[data-action]",
    );
    if (!target) return;
    if (target.dataset.tab === "inApp" || target.dataset.tab === "official") {
      tab = target.dataset.tab;
      if (tab === "official" && !records.length) void load();
      else render();
    }
    if (
      target.dataset.area === "support" ||
      target.dataset.area === "funding"
    ) {
      area = target.dataset.area;
      query = "";
      void load();
    }
    if (target.dataset.record) {
      selected = target.dataset.record;
      render();
    }
    if (target.dataset.action === "retry") void load();
    if (target.dataset.action === "prepare" && target.dataset.id)
      options.onPrepareExternal?.(target.dataset.id);
  });
  root.addEventListener("input", (event) => {
    if ((event.target as HTMLElement).id !== "pg-query") return;
    query = (event.target as HTMLInputElement).value.toLowerCase();
    const position = (event.target as HTMLInputElement).selectionStart;
    render();
    const input = root.querySelector<HTMLInputElement>("#pg-query");
    input?.focus();
    if (position !== null) input?.setSelectionRange(position, position);
  });

  render();
  return root;
}
