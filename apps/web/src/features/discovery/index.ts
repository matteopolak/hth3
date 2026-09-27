import type { Locale } from "@civicresolve/contracts/v1";
import {
  ArrowUpRight,
  Building2,
  BusFront,
  ChevronDown,
  HandHeart,
  LibraryBig,
  MapPin,
  SlidersHorizontal,
} from "lucide-static";
import { createDiscoveryAreaStructure } from "./area-structures.js";
import { createNearbyMap, type NearbyMapView } from "./nearby-map.js";
import "./styles.css";

export type DiscoveryArea =
  | "all"
  | "jobs"
  | "support"
  | "funding"
  | "nearby"
  | "participation"
  | "saved";

type ServiceCategory =
  | "government"
  | "library"
  | "community"
  | "transit"
  | "other";

interface ServiceFact {
  status: "verified" | "stale" | "unknown";
  summary: string;
  verifiedAt: string | null;
  sourceUrl: string;
}

interface PublicService {
  category: ServiceCategory;
  address: string | null;
  coordinatesSourceUrl: string | null;
  publicAccess: ServiceFact;
  services: ServiceFact;
  hours: ServiceFact;
  accessibility: ServiceFact;
  pinEligible: boolean;
  pinKind: "official" | "sample" | null;
  locationPrecision: "site" | "station";
}

interface DiscoveryItem {
  id: string;
  origin: "official_external" | "participating_org" | "sample";
  type:
    | "job_posting"
    | "support_program"
    | "funding_opportunity"
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
  listing?: {
    category: "job" | "support" | "funding";
    postedDate: string | null;
    closingDate: string | null;
    locationText: string | null;
    applicationStatus: "open" | "closed" | "unknown";
  } | null;
  service?: PublicService;
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
  onPrepare?: (recordId: string) => void;
}

const API = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

const copy = {
  en: {
    search: "Search",
    supportRefineSearch: "Search by keyword or city",
    keywords: "Keywords",
    searchPlaceholder: "Role, program, or service",
    location: "City or location",
    locationPlaceholder: "City, province, or Canada",
    filters: "Filters",
    results: "Results",
    finder: "Official finder",
    jobPosting: "Official job posting",
    jobBoards: "Official job boards",
    jobBoardsNote: "Browse more openings on the publisher’s site.",
    noJobPostings:
      "Try another role or city, or browse an official job board below.",
    jobEmployer: "Employer",
    jobLocation: "Location",
    jobClosing: "Closing date",
    jobPosted: "Posted",
    jobStatus: "Application status",
    jobOpen: "Open per source",
    jobClosed: "Closed per source",
    jobUnknown: "Check on official site",
    jobDateNote: "Confirm the closing time on the official posting.",
    jobOfficial: "View official posting",
    jobNoDeadline: "Check official posting",
    verifiedListing: "Verified listing",
    locationRecord: "Service location",
    serviceCategory: "Service type",
    allServices: "All services",
    serviceGovernment: "Government",
    serviceLibrary: "Libraries",
    serviceCommunity: "Community",
    serviceTransit: "Transit",
    serviceOther: "Other",
    serviceDetails: "Service details",
    serviceAddress: "Address",
    servicePublicAccess: "Public access",
    serviceServices: "Services",
    serviceHours: "Hours",
    serviceAccessibility: "Accessibility",
    serviceVerified: "Source checked",
    serviceStale: "Check again before visiting",
    serviceUnknown: "Not verified",
    serviceSource: "Source",
    serviceNoAddress: "Address not verified",
    serviceNoSummary: "No verified details available.",
    serviceStationPin:
      "Approximate station location; check the source for the counter entrance.",
    consultationFinder: "Consultation finder",
    sourceRecord: "Official source",
    chooseResult: "Choose a result to view details.",
    list: "List",
    map: "Map",
    jurisdiction: "Jurisdiction",
    allJurisdictions: "All jurisdictions",
    currentOnly: "Current only",
    noResults: "No matching records from reviewed sources yet.",
    noSaved: "Nothing saved yet.",
    emptyJobs: "No individual job postings match",
    emptySupport: "No matching support sources",
    emptyFunding: "No matching funding sources",
    emptyNearby: "No matching public services",
    emptyParticipation: "No matching participation sources",
    emptyAll: "No matching sources",
    emptyFiltered: "Try another keyword or city, or clear your search.",
    emptyUnfiltered: "Reviewed sources will appear here when available.",
    emptySaved: "Save a source to keep it here with your checklist.",
    jobBankAction: "Search Job Bank",
    jobBankSource: "Government of Canada · jobbank.gc.ca",
    clearSearch: "Clear search",
    loading: "Loading sources…",
    source: "Source",
    evidence: "Evidence",
    terms: "Terms",
    licence: "Licence",
    verified: "Reviewed",
    freshness: "Freshness",
    unknown: "Unknown",
    official: "Open official site",
    prepareApplication: "Prepare application",
    prepareVisit: "Plan visit",
    prepareParticipation: "Prepare participation",
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
    resultSingular: "result",
    resultCount: "results",
    nearbyNoLocation: "Location not set.",
    nearbyBrowse:
      "Enter a city above to narrow public services. Without a city, results are sorted by jurisdiction and name, not distance.",
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
    supportRefineSearch: "Rechercher par mot-clé ou par ville",
    keywords: "Mots-clés",
    searchPlaceholder: "Poste, programme ou service",
    location: "Ville ou lieu",
    locationPlaceholder: "Ville, province ou Canada",
    filters: "Filtres",
    results: "Résultats",
    finder: "Moteur de recherche officiel",
    jobPosting: "Offre d’emploi officielle",
    jobBoards: "Sites officiels d’emploi",
    jobBoardsNote: "Consultez d’autres postes sur le site de l’éditeur.",
    noJobPostings:
      "Essayez un autre poste ou une autre ville, ou consultez un site d’emploi officiel ci-dessous.",
    jobEmployer: "Employeur",
    jobLocation: "Lieu",
    jobClosing: "Date limite",
    jobPosted: "Publiée",
    jobStatus: "État de la candidature",
    jobOpen: "Ouverte selon la source",
    jobClosed: "Fermée selon la source",
    jobUnknown: "Vérifiez sur le site officiel",
    jobDateNote: "Confirmez l’heure limite dans l’offre officielle.",
    jobOfficial: "Voir l’offre officielle",
    jobNoDeadline: "Vérifiez l’offre officielle",
    verifiedListing: "Annonce vérifiée",
    locationRecord: "Point de service",
    serviceCategory: "Type de service",
    allServices: "Tous les services",
    serviceGovernment: "Gouvernement",
    serviceLibrary: "Bibliothèques",
    serviceCommunity: "Communauté",
    serviceTransit: "Transport",
    serviceOther: "Autres",
    serviceDetails: "Détails du service",
    serviceAddress: "Adresse",
    servicePublicAccess: "Accès public",
    serviceServices: "Services",
    serviceHours: "Heures",
    serviceAccessibility: "Accessibilité",
    serviceVerified: "Source vérifiée",
    serviceStale: "Vérifiez avant de vous déplacer",
    serviceUnknown: "Non vérifié",
    serviceSource: "Source",
    serviceNoAddress: "Adresse non vérifiée",
    serviceNoSummary: "Aucun détail vérifié disponible.",
    serviceStationPin:
      "Emplacement approximatif de la station; vérifiez l’entrée du comptoir à la source.",
    consultationFinder: "Recherche de consultations",
    sourceRecord: "Source officielle",
    chooseResult: "Choisissez un résultat pour voir les détails.",
    list: "Liste",
    map: "Carte",
    jurisdiction: "Territoire",
    allJurisdictions: "Tous les territoires",
    currentOnly: "Actuels seulement",
    noResults:
      "Aucun dossier correspondant des sources examinées pour le moment.",
    noSaved: "Aucun élément enregistré.",
    emptyJobs: "Aucune offre d’emploi individuelle ne correspond",
    emptySupport: "Aucune source d’aide correspondante",
    emptyFunding: "Aucune source de financement correspondante",
    emptyNearby: "Aucun service public correspondant",
    emptyParticipation: "Aucune source de participation correspondante",
    emptyAll: "Aucune source correspondante",
    emptyFiltered:
      "Essayez un autre mot-clé ou une autre ville, ou effacez la recherche.",
    emptyUnfiltered:
      "Les sources examinées apparaîtront ici lorsqu’elles seront disponibles.",
    emptySaved:
      "Enregistrez une source pour la retrouver ici avec votre liste.",
    jobBankAction: "Chercher sur le Guichet-Emplois",
    jobBankSource: "Gouvernement du Canada · jobbank.gc.ca",
    clearSearch: "Effacer la recherche",
    loading: "Chargement des sources…",
    source: "Source",
    evidence: "Preuve",
    terms: "Conditions",
    licence: "Licence",
    verified: "Examiné",
    freshness: "Actualité",
    unknown: "Inconnue",
    official: "Ouvrir le site officiel",
    prepareApplication: "Préparer la candidature",
    prepareVisit: "Planifier une visite",
    prepareParticipation: "Préparer la participation",
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
    resultSingular: "résultat",
    resultCount: "résultats",
    nearbyNoLocation: "Lieu non défini.",
    nearbyBrowse:
      "Entrez une ville ci-dessus pour limiter les services publics. Sans ville, les résultats sont triés par territoire et par nom, pas par distance.",
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
  onPrepare,
}: Options): HTMLElement {
  const text = copy[locale];
  const root = node("section", `discovery-page discovery-page-area-${area}`);
  let query = "";
  let queryDraft = "";
  let location = "";
  let locationDraft = "";
  let currentOnly = false;
  let serviceCategory: ServiceCategory | "all" = "all";
  const includeSamples =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("practice") === "1";
  let display: "list" | "map" = area === "nearby" ? "map" : "list";
  let mobileDetail = false;
  const pageSize = area === "nearby" ? 100 : 30;
  let offset = 0;
  let total = 0;
  let records: DiscoveryItem[] = [];
  let jobBoards: DiscoveryItem[] = [];
  let nearbyMap: NearbyMapView | null = null;
  let nearbyMapFingerprint = "";
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
          limit: String(pageSize),
          offset: String(offset),
        });
        if (area !== "all" && area !== "nearby") params.set("area", area);
        if (area === "nearby" && serviceCategory !== "all")
          params.set("category", serviceCategory);
        if (query) params.set("q", query);
        if (location) params.set("location", location);
        if (currentOnly) params.set("freshness", "current");
        if (includeSamples) params.set("includeSamples", "true");
        const [result, boardsResult] = await Promise.all([
          request<{ items: DiscoveryItem[]; total: number }>(
            `/${area === "nearby" ? "nearby" : "discovery"}?${params}`,
          ),
          area === "jobs"
            ? request<{ items: DiscoveryItem[] }>(
                "/discovery?area=jobs&type=jobs_finder&includeFinders=true&limit=30",
              ).catch(() => null)
            : Promise.resolve(null),
        ]);
        records = append ? records.concat(result.items) : result.items;
        total = result.total;
        if (area === "jobs")
          jobBoards =
            boardsResult?.items.filter(
              (item) =>
                item.type === "jobs_finder" &&
                item.origin === "official_external" &&
                isHttps(item.sourceUrl),
            ) ?? [];
        if (!append && !records.some((item) => item.id === selected?.id)) {
          selected =
            area === "support" || area === "funding" || area === "nearby"
              ? null
              : (records[0] ?? null);
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

  function serviceCategoryName(category: ServiceCategory): string {
    const names = {
      government: text.serviceGovernment,
      library: text.serviceLibrary,
      community: text.serviceCommunity,
      transit: text.serviceTransit,
      other: text.serviceOther,
    };
    return names[category];
  }

  function serviceIcon(category: ServiceCategory): HTMLElement {
    const icons = {
      government: Building2,
      library: LibraryBig,
      community: HandHeart,
      transit: BusFront,
      other: MapPin,
    };
    const icon = node("span", `discovery-service-icon category-${category}`);
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = icons[category];
    return icon;
  }

  function render(): void {
    root.classList.toggle("is-detail-open", mobileDetail);
    root.classList.toggle("has-selection", selected !== null);
    if (display !== "map" && nearbyMap) {
      nearbyMap.destroy();
      nearbyMap = null;
      nearbyMapFingerprint = "";
    }
    root.replaceChildren();
    if (area !== "saved") root.append(filters());
    if (area === "nearby" && !location) {
      const context = node("p", "discovery-nearby-context");
      context.append(
        node("strong", "", text.nearbyNoLocation),
        document.createTextNode(` ${text.nearbyBrowse}`),
      );
      root.append(context);
    }
    const tools = node("div", "discovery-toolbar");
    const displayed =
      area === "saved" ? saved.map((entry) => entry.item) : records;
    if (!displayed.length && nearbyMap) {
      nearbyMap.destroy();
      nearbyMap = null;
      nearbyMapFingerprint = "";
    }
    const resultTotal = area === "saved" ? displayed.length : total;
    tools.append(
      node(
        "strong",
        "discovery-result-count",
        `${resultTotal} ${resultTotal === 1 ? text.resultSingular : text.resultCount}`,
      ),
    );
    if (area === "nearby" && displayed.length > 0) {
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
    if (!displayed.length) {
      if (loading) root.append(node("p", "discovery-loading", text.loading));
      else if (!error) {
        root.append(emptyState());
        if (area === "jobs") root.append(jobBoardSection());
      }
      return;
    }
    const workspace = node(
      "div",
      `discovery-workspace ${mobileDetail ? "is-detail-open" : ""} ${selected ? "" : "is-empty"}`,
    );
    const results = node("section", "discovery-results");
    if (display === "map" && area === "nearby") results.append(map(displayed));
    else {
      for (const item of displayed) results.append(row(item));
      if (area !== "saved" && records.length < total) {
        results.append(
          action(text.more, "discovery-button discovery-more", () => {
            offset += pageSize;
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
    if (area === "jobs" && total <= 3 && !loading)
      root.append(jobBoardSection());
  }

  function jobBoardSection(): HTMLElement {
    const section = node("section", "discovery-job-boards");
    section.append(
      node("h2", "", text.jobBoards),
      node("p", "", text.jobBoardsNote),
    );
    const links = node("div", "discovery-job-board-links");
    for (const board of jobBoards.slice(0, 4)) {
      const link = node("a", "discovery-job-board");
      link.href = board.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(
        node("strong", "", board.title),
        node("span", "", board.publisher),
      );
      const arrow = node("span", "discovery-job-board-arrow");
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML = ArrowUpRight;
      link.append(arrow);
      links.append(link);
    }
    if (!links.childElementCount) {
      const link = node("a", "discovery-job-board");
      link.href = "https://www.jobbank.gc.ca/jobsearch/jobsearch";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(
        node("strong", "", text.jobBankAction),
        node("span", "", text.jobBankSource),
      );
      const arrow = node("span", "discovery-job-board-arrow");
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML = ArrowUpRight;
      link.append(arrow);
      links.append(link);
    }
    section.append(links);
    return section;
  }

  function emptyState(): HTMLElement {
    const section = node("section", "discovery-no-results");
    const titleKey = {
      all: "emptyAll",
      jobs: "emptyJobs",
      support: "emptySupport",
      funding: "emptyFunding",
      nearby: "emptyNearby",
      participation: "emptyParticipation",
      saved: "noSaved",
    } as const;
    section.append(node("h2", "", text[titleKey[area]]));
    if (area === "saved") {
      section.append(node("p", "", text.emptySaved));
      return section;
    }
    const hasFilters = Boolean(
      query || location || currentOnly || serviceCategory !== "all",
    );
    section.append(
      node(
        "p",
        "",
        area === "jobs"
          ? text.noJobPostings
          : hasFilters
            ? text.emptyFiltered
            : text.emptyUnfiltered,
      ),
    );
    const actions = node("div", "discovery-no-results-actions");
    if (hasFilters) {
      actions.append(
        action(text.clearSearch, "discovery-button", () => {
          query = "";
          queryDraft = "";
          location = "";
          locationDraft = "";
          currentOnly = false;
          serviceCategory = "all";
          offset = 0;
          void refresh();
        }),
      );
    }
    if (actions.childElementCount) section.append(actions);
    return section;
  }

  function filters(): HTMLElement {
    const form = node("form", `discovery-search discovery-search-${area}`);
    if (area === "jobs" || area === "support" || area === "funding") {
      form.append(
        createDiscoveryAreaStructure({
          area,
          locale,
          selectedLocation: location,
          onBrowse: () => {
            const search =
              root.querySelector<HTMLInputElement>(".discovery-input");
            search?.scrollIntoView({
              block: "center",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            });
            search?.focus();
          },
          onSearchLocation: (nextLocation) => {
            location = nextLocation;
            locationDraft = nextLocation;
            query = queryDraft.trim();
            offset = 0;
            mobileDetail = false;
            void refresh();
          },
        }),
      );
    }
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
    if (area === "support") {
      const more = node("details", "discovery-support-query");
      more.open = Boolean(queryDraft || locationDraft || currentOnly);
      const summary = node("summary", "", text.supportRefineSearch);
      const summaryIcon = node("span", "discovery-support-query-icon");
      summaryIcon.setAttribute("aria-hidden", "true");
      summaryIcon.innerHTML = SlidersHorizontal;
      summary.prepend(summaryIcon);
      const chevron = node("span", "discovery-support-query-chevron");
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = ChevronDown;
      summary.append(chevron);
      const controls = node("div", "discovery-support-query-controls");
      controls.append(fields, bottom);
      more.append(summary, controls);
      form.append(more);
    } else form.append(fields);
    if (area === "nearby") {
      const categories = node("div", "discovery-service-filters");
      categories.setAttribute("role", "group");
      categories.setAttribute("aria-label", text.serviceCategory);
      for (const category of [
        "all",
        "government",
        "library",
        "community",
        "transit",
        "other",
      ] as const) {
        const label =
          category === "all" ? text.allServices : serviceCategoryName(category);
        const filter = action(
          label,
          `discovery-service-filter ${serviceCategory === category ? "is-active" : ""}`,
          () => {
            serviceCategory = category;
            query = queryDraft.trim();
            location = locationDraft.trim();
            offset = 0;
            mobileDetail = false;
            void refresh();
          },
        );
        filter.setAttribute(
          "aria-pressed",
          String(serviceCategory === category),
        );
        categories.append(filter);
      }
      form.append(categories);
    }
    if (area !== "support") form.append(bottom);
    return form;
  }

  function row(item: DiscoveryItem): HTMLElement {
    const entry = node(
      "button",
      `discovery-row ${selected?.id === item.id ? "is-selected" : ""}`,
    ) as HTMLButtonElement;
    entry.type = "button";
    entry.setAttribute("aria-pressed", String(selected?.id === item.id));
    entry.addEventListener("click", () => {
      selected = item;
      mobileDetail = true;
      notice = "";
      render();
      if (area === "support" || area === "funding") {
        root
          .querySelector<HTMLElement>(".discovery-detail h3")
          ?.focus({ preventScroll: true });
        root.querySelector(".discovery-detail-panel")?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    });
    entry.append(node("span", "discovery-type", itemType(item)));
    const title = node("span", "discovery-row-title", item.title);
    const compactSummary =
      item.type === "service_location"
        ? item.summary
            .replace(/^Service BC office at /, "")
            .replace(/\. Confirm hours.*$/i, "")
        : item.summary;
    if (area === "nearby" && item.service) {
      const heading = node("span", "discovery-service-row-heading");
      heading.append(serviceIcon(item.service.category), title);
      entry.append(heading);
    } else entry.append(title);
    if (area !== "jobs" || item.type !== "job_posting")
      entry.append(node("span", "discovery-summary", compactSummary));
    const meta = node(
      "span",
      `discovery-meta ${area === "jobs" && item.type === "job_posting" ? "discovery-job-meta" : ""}`,
    );
    if (area === "jobs" && item.type === "job_posting") {
      meta.append(node("span", "", item.publisher));
      meta.append(
        node("span", "", item.listing?.locationText ?? item.jurisdiction.name),
      );
      meta.append(
        node(
          "span",
          "",
          `${text.jobClosing}: ${item.listing?.closingDate ? formatDateOnly(item.listing.closingDate, locale) : text.jobNoDeadline}`,
        ),
      );
      meta.append(node("span", "", jobStatus(item)));
    } else
      meta.append(
        node("span", "", item.publisher),
        node("span", "", item.jurisdiction.name),
      );
    if (area === "nearby" && item.service?.address)
      meta.append(node("span", "", item.service.address));
    if (item.origin === "sample")
      meta.append(node("span", "discovery-practice", text.practiceLabel));
    else if (item.freshness !== "current")
      meta.append(node("span", "", item.freshness));
    entry.append(meta);
    return entry;
  }

  function map(items: DiscoveryItem[]): HTMLElement {
    const points = items
      .filter((item) => item.coordinates && item.service?.pinEligible === true)
      .map((item) => ({
        id: item.id,
        title: item.title,
        latitude: item.coordinates!.latitude,
        longitude: item.coordinates!.longitude,
        category: item.service!.category,
      }));
    const fingerprint = points
      .map(
        (point) =>
          `${point.id}:${point.latitude}:${point.longitude}:${point.category}`,
      )
      .join("|");
    if (!nearbyMap) {
      nearbyMap = createNearbyMap({
        locale,
        points,
        selectedId: selected?.id ?? null,
        onSelect: (id) => {
          const match = records.find((item) => item.id === id);
          if (!match) return;
          selected = match;
          mobileDetail = true;
          notice = "";
          render();
        },
        onFallback: () => {
          display = "list";
          mobileDetail = false;
          render();
        },
      });
      nearbyMapFingerprint = fingerprint;
    } else if (nearbyMapFingerprint !== fingerprint) {
      nearbyMap.setPoints(points, selected?.id ?? null);
      nearbyMapFingerprint = fingerprint;
    } else nearbyMap.setSelected(selected?.id ?? null);
    requestAnimationFrame(() => nearbyMap?.resize());
    return nearbyMap.element;
  }

  function itemType(item: DiscoveryItem): string {
    if (item.origin === "sample") return text.practiceLabel;
    if (item.type === "job_posting") return text.jobPosting;
    if (area === "nearby" && item.service)
      return serviceCategoryName(item.service.category);
    if (item.origin === "participating_org") return text.verifiedListing;
    if (item.type === "service_location") return text.locationRecord;
    if (item.type === "consultation_finder") return text.consultationFinder;
    if (item.type.endsWith("_finder")) return text.finder;
    return text.sourceRecord;
  }

  function detail(item: DiscoveryItem): HTMLElement {
    const view = node("article", "discovery-detail");
    const heading = node("h3", "", item.title);
    heading.tabIndex = -1;
    view.append(
      action(text.back, "discovery-back discovery-link", () => {
        mobileDetail = false;
        render();
        if (area === "support" || area === "funding")
          root.querySelector(".discovery-results")?.scrollIntoView({
            block: "start",
            behavior: "instant",
          });
      }),
    );
    view.append(
      node("span", "discovery-type", itemType(item)),
      heading,
      node(
        "p",
        "discovery-detail-publisher",
        `${item.publisher} · ${item.jurisdiction.name}`,
      ),
    );
    if (area !== "nearby" || !item.service)
      view.append(node("p", "discovery-summary", item.summary));
    if (item.origin === "sample")
      view.append(node("p", "discovery-notice", text.practiceNote));
    if (item.type === "job_posting") view.append(jobFacts(item));
    if (item.freshness !== "current")
      view.append(node("p", "discovery-muted", text.staleNote));
    const actions = node("div", "discovery-actions");
    if (item.handoff) {
      if (item.origin === "official_external" && onPrepare) {
        const prepareLabel =
          item.area === "nearby"
            ? text.prepareVisit
            : item.area === "participation"
              ? text.prepareParticipation
              : text.prepareApplication;
        actions.append(
          action(
            prepareLabel,
            "discovery-button discovery-button-primary",
            () => onPrepare(item.id),
          ),
        );
      }
      actions.append(
        action(
          item.type === "job_posting" ? text.jobOfficial : text.official,
          `discovery-button ${onPrepare && item.origin === "official_external" ? "" : "discovery-button-primary"}`,
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
    if (area === "nearby" && item.service)
      view.append(serviceDetails(item.service));
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
      ...(area === "nearby" && item.service?.coordinatesSourceUrl
        ? [[text.map, item.service.coordinatesSourceUrl] as [string, string]]
        : []),
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

  function jobStatus(item: DiscoveryItem): string {
    if (item.listing?.applicationStatus === "open") return text.jobOpen;
    if (item.listing?.applicationStatus === "closed") return text.jobClosed;
    return text.jobUnknown;
  }

  function jobFacts(item: DiscoveryItem): HTMLElement {
    const facts = node("dl", "discovery-job-facts");
    for (const [label, value] of [
      [text.jobEmployer, item.publisher],
      [text.jobLocation, item.listing?.locationText ?? item.jurisdiction.name],
      [
        text.jobClosing,
        item.listing?.closingDate
          ? formatDateOnly(item.listing.closingDate, locale)
          : text.jobNoDeadline,
      ],
      [text.jobStatus, jobStatus(item)],
      [
        text.jobPosted,
        item.listing?.postedDate
          ? formatDateOnly(item.listing.postedDate, locale)
          : null,
      ],
    ] as Array<[string, string | null]>) {
      if (!value) continue;
      facts.append(node("dt", "", label), node("dd", "", value));
    }
    const section = node("section", "discovery-job-details");
    section.append(facts);
    if (item.listing?.closingDate)
      section.append(node("p", "discovery-muted", text.jobDateNote));
    return section;
  }

  function serviceDetails(service: PublicService): HTMLElement {
    const section = node("section", "discovery-service-details");
    section.append(node("h4", "", text.serviceDetails));
    const address = node("div", "discovery-service-address");
    address.append(
      node("span", "", text.serviceAddress),
      node("strong", "", service.address ?? text.serviceNoAddress),
    );
    section.append(address);
    if (service.locationPrecision === "station")
      section.append(
        node("p", "discovery-service-precision", text.serviceStationPin),
      );
    const facts = node("div", "discovery-service-facts");
    for (const [label, fact] of [
      [text.servicePublicAccess, service.publicAccess],
      [text.serviceServices, service.services],
      [text.serviceHours, service.hours],
      [text.serviceAccessibility, service.accessibility],
    ] as Array<[string, ServiceFact]>) {
      const entry = node("div", "discovery-service-fact");
      entry.append(node("strong", "", label));
      entry.append(node("p", "", fact.summary || text.serviceNoSummary));
      const meta = node("div", "discovery-service-fact-meta");
      const status =
        fact.status === "verified"
          ? text.serviceVerified
          : fact.status === "stale"
            ? text.serviceStale
            : text.serviceUnknown;
      const date = fact.verifiedAt ? new Date(fact.verifiedAt) : null;
      const validDate =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString(locale)
          : null;
      meta.append(
        node("span", "", validDate ? `${status} · ${validDate}` : status),
      );
      if (isHttps(fact.sourceUrl)) {
        const link = node("a", "discovery-link", text.serviceSource);
        link.href = fact.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        meta.append(link);
      }
      entry.append(meta);
      facts.append(entry);
    }
    section.append(facts);
    return section;
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

function formatDateOnly(value: string, locale: Locale): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
