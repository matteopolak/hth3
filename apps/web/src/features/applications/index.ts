import type { Locale, ResumeView } from "@civicresolve/contracts/v1";
import type { ApplicationView } from "../../platform/api.js";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  FileText,
  MessageSquare,
  Search,
  Send,
  Upload,
} from "lucide-static";
import {
  applicationsApi,
  type ApplicationMessage,
  type OfficialJob,
  type Posting,
} from "./api.js";
import "./styles.css";

interface Options {
  view: "browse" | "mine";
  locale: Locale;
  token: string | null;
  onSignIn?: () => void;
  onProfile?: () => void;
  onPrepareExternal?: (recordId: string) => void;
}

type Result =
  | { kind: "inApp"; posting: Posting }
  | { kind: "official"; record: OfficialJob };
type Filter = "all" | "inApp" | "official";
const h = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (svg: string) =>
  `<span class="ja-icon" aria-hidden="true">${svg}</span>`;
const date = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const copy = {
  en: {
    browse: "Find a role",
    mine: "My applications",
    search: "Role, skill, or organization",
    location: "City or region",
    go: "Search",
    all: "All",
    inApp: "Apply in Envoy",
    official: "Official sources",
    role: "role",
    roles: "roles",
    application: "application",
    applications: "applications",
    practice: "Practice listing",
    practiceNote:
      "This is an Envoy practice posting. It is not a real vacancy or affiliated with the named city or government.",
    officialFinder: "Official job finder",
    officialNote:
      "This source leads to the publisher’s own job search. Open positions and application requirements must be checked there. Envoy does not record an external submission.",
    source: "Source",
    publisher: "Publisher",
    locationLabel: "Location",
    openOfficial: "Open official site",
    prepare: "Prepare for official site",
    apply: "Start application",
    signIn: "Sign in to apply",
    about: "About the role",
    review: "Review application",
    experience: "Relevant experience",
    experienceHint: "Briefly connect your experience to this role.",
    availability: "Availability",
    availabilityHint: "When could you start?",
    resume: "Résumé",
    noResume: "No résumé selected",
    chooseResume: "Choose an uploaded résumé",
    upload: "Upload PDF or DOCX",
    extract: "Review résumé suggestions",
    use: "Use this",
    sourceText: "From your résumé",
    profile: "Manage résumé in profile",
    share: "Share the selected résumé with the employer after submission",
    noAutomaticShare:
      "Your résumé stays private until you choose to share it with this application.",
    confirm: "I reviewed my answers and want to submit this application",
    practiceAgree: "I understand this is a practice application",
    submit: "Submit application",
    back: "Back",
    submitted: "Application submitted",
    shareFailed:
      "The application was submitted, but résumé sharing failed. You can share it from your profile.",
    noResults: "No roles match your search.",
    noApplications: "No applications yet.",
    loading: "Loading roles…",
    error: "Unable to load roles.",
    officialUnavailable:
      "Official sources are temporarily unavailable. Participating roles are still shown.",
    participatingUnavailable:
      "Participating roles are temporarily unavailable. Official sources are still shown.",
    retry: "Try again",
    updates: "Updates",
    details: "Application details",
    reply: "Write a message",
    send: "Send",
    noMessages: "No messages yet.",
    status: {
      submitted: "Submitted",
      under_review: "In review",
      information_requested: "Information requested",
      shortlisted: "Shortlisted",
      declined: "Declined",
      offer: "Offer",
    },
    applicant: "You",
    employer: "Employer",
    continue: "Continue",
    selected: "Selected résumé",
    required: "Add your experience and availability to continue.",
  },
  fr: {
    browse: "Trouver un poste",
    mine: "Mes candidatures",
    search: "Poste, compétence ou organisation",
    location: "Ville ou région",
    go: "Rechercher",
    all: "Tout",
    inApp: "Postuler dans Envoy",
    official: "Sources officielles",
    role: "poste",
    roles: "postes",
    application: "candidature",
    applications: "candidatures",
    practice: "Offre d’exercice",
    practiceNote:
      "Cette offre d’Envoy est un exercice. Ce n’est pas un vrai poste et elle n’est affiliée à aucune ville ou administration nommée.",
    officialFinder: "Recherche d’emplois officielle",
    officialNote:
      "Cette source mène à la recherche d’emplois de l’éditeur. Vérifiez les postes et les exigences sur son site. Envoy n’enregistre aucune demande externe.",
    source: "Source",
    publisher: "Éditeur",
    locationLabel: "Lieu",
    openOfficial: "Ouvrir le site officiel",
    prepare: "Préparer pour le site officiel",
    apply: "Commencer la candidature",
    signIn: "Se connecter pour postuler",
    about: "À propos du poste",
    review: "Vérifier la candidature",
    experience: "Expérience pertinente",
    experienceHint: "Reliez brièvement votre expérience à ce poste.",
    availability: "Disponibilité",
    availabilityHint: "Quand pourriez-vous commencer?",
    resume: "CV",
    noResume: "Aucun CV sélectionné",
    chooseResume: "Choisir un CV téléversé",
    upload: "Téléverser PDF ou DOCX",
    extract: "Examiner les suggestions du CV",
    use: "Utiliser",
    sourceText: "Extrait de votre CV",
    profile: "Gérer le CV dans le profil",
    share: "Partager le CV choisi avec l’employeur après la soumission",
    noAutomaticShare:
      "Votre CV reste privé jusqu’à ce que vous choisissiez de le partager avec cette candidature.",
    confirm: "J’ai vérifié mes réponses et je veux soumettre cette candidature",
    practiceAgree: "Je comprends qu’il s’agit d’une candidature d’exercice",
    submit: "Soumettre la candidature",
    back: "Retour",
    submitted: "Candidature soumise",
    shareFailed:
      "La candidature a été soumise, mais le partage du CV a échoué. Vous pouvez le partager depuis votre profil.",
    noResults: "Aucun poste ne correspond.",
    noApplications: "Aucune candidature.",
    loading: "Chargement des postes…",
    error: "Impossible de charger les postes.",
    officialUnavailable:
      "Les sources officielles sont temporairement indisponibles. Les postes participants restent affichés.",
    participatingUnavailable:
      "Les postes participants sont temporairement indisponibles. Les sources officielles restent affichées.",
    retry: "Réessayer",
    updates: "Mises à jour",
    details: "Détails de la candidature",
    reply: "Écrire un message",
    send: "Envoyer",
    noMessages: "Aucun message.",
    status: {
      submitted: "Soumise",
      under_review: "À l’étude",
      information_requested: "Renseignements demandés",
      shortlisted: "Présélectionnée",
      declined: "Refusée",
      offer: "Offre",
    },
    applicant: "Vous",
    employer: "Employeur",
    continue: "Continuer",
    selected: "CV choisi",
    required: "Ajoutez votre expérience et votre disponibilité pour continuer.",
  },
} as const;

export function createPublicApplicationsPage(options: Options): HTMLElement {
  const text = copy[options.locale];
  const root = document.createElement("section");
  root.className = "job-applications";
  let view = options.view;
  let postings: Posting[] = [];
  let official: OfficialJob[] = [];
  let applications: ApplicationView[] = [];
  let messages: ApplicationMessage[] = [];
  let resumes: ResumeView[] = [];
  let selected = "";
  let selectedApplication = "";
  let filter: Filter = "all";
  let search = "";
  let place = "";
  let searchDraft = "";
  let placeDraft = "";
  let step: "detail" | "form" | "review" | "submitted" = "detail";
  let experience = "";
  let availability = "";
  let selectedResume = "";
  let suggestion: { value: string; source: string } | null = null;
  let loading = true;
  let busy = false;
  let error = "";
  let notice = "";

  const allResults = (): Result[] => [
    ...postings.map((posting) => ({ kind: "inApp" as const, posting })),
    ...official.map((record) => ({ kind: "official" as const, record })),
  ];
  const key = (item: Result) =>
    `${item.kind}:${item.kind === "inApp" ? item.posting.id : item.record.id}`;
  const visibleResults = (): Result[] => {
    const needle = search.toLowerCase();
    const city = place.toLowerCase();
    return allResults()
      .filter((item) => filter === "all" || item.kind === filter)
      .filter((item) => {
        const title =
          item.kind === "inApp" ? item.posting.title : item.record.title;
        const organization =
          item.kind === "inApp"
            ? item.posting.organizationName
            : item.record.publisher;
        const summary =
          item.kind === "inApp"
            ? item.posting.description
            : item.record.summary;
        const location =
          item.kind === "inApp"
            ? (item.posting.location ?? "")
            : item.record.jurisdiction.name;
        return (
          `${title} ${organization} ${summary}`
            .toLowerCase()
            .includes(needle) && location.toLowerCase().includes(city)
        );
      });
  };
  const active = () =>
    visibleResults().find((item) => key(item) === selected) ??
    visibleResults()[0] ??
    null;
  const activeApplication = () =>
    applications.find((item) => item.id === selectedApplication) ?? null;

  async function load(): Promise<void> {
    loading = true;
    error = "";
    render();
    try {
      if (view === "browse") {
        const [jobs, sources] = await Promise.allSettled([
          applicationsApi.postings(),
          applicationsApi.official(),
        ]);
        postings = jobs.status === "fulfilled" ? jobs.value : [];
        official = sources.status === "fulfilled" ? sources.value : [];
        if (jobs.status === "rejected" && sources.status === "rejected")
          throw new Error(text.error);
        if (jobs.status === "rejected") error = text.participatingUnavailable;
        if (sources.status === "rejected") error = text.officialUnavailable;
        selected ||= allResults()[0] ? key(allResults()[0]!) : "";
        if (options.token)
          resumes = await applicationsApi
            .resumes(options.token)
            .catch(() => []);
      } else if (options.token) {
        const [mine, files] = await Promise.allSettled([
          applicationsApi.own(options.token),
          applicationsApi.resumes(options.token),
        ]);
        if (mine.status === "rejected") throw mine.reason;
        applications = mine.value;
        resumes = files.status === "fulfilled" ? files.value : [];
        selectedApplication ||= applications[0]?.id ?? "";
        if (selectedApplication) await loadMessages();
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : text.error;
    } finally {
      loading = false;
      render();
    }
  }

  async function loadMessages(): Promise<void> {
    if (!options.token || !selectedApplication) {
      messages = [];
      return;
    }
    try {
      messages = await applicationsApi.messages(
        options.token,
        selectedApplication,
      );
    } catch {
      messages = [];
    }
  }

  async function perform(task: () => Promise<void>): Promise<void> {
    busy = true;
    error = "";
    notice = "";
    render();
    try {
      await task();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : text.error;
    } finally {
      busy = false;
      render();
    }
  }

  function resultList(): string {
    const rows = visibleResults();
    return `<div class="ja-list-head"><strong>${rows.length} ${h(rows.length === 1 ? text.role : text.roles)}</strong><div class="ja-filters"><button data-filter="all" class="${filter === "all" ? "active" : ""}">${h(text.all)}</button><button data-filter="inApp" class="${filter === "inApp" ? "active" : ""}">${h(text.inApp)}</button><button data-filter="official" class="${filter === "official" ? "active" : ""}">${h(text.official)}</button></div></div><div class="ja-result-list">${
      rows
        .map((item) => {
          const title =
            item.kind === "inApp" ? item.posting.title : item.record.title;
          const organization =
            item.kind === "inApp"
              ? item.posting.organizationName
              : item.record.publisher;
          const location =
            item.kind === "inApp"
              ? (item.posting.location ?? "")
              : item.record.jurisdiction.name;
          const badge =
            item.kind === "inApp"
              ? item.posting.sample
                ? text.practice
                : text.inApp
              : text.officialFinder;
          return `<button class="ja-result ${active() && key(active()!) === key(item) ? "selected" : ""}" data-result="${h(key(item))}"><span class="ja-result-badge">${h(badge)}</span><strong>${h(title)}</strong><span>${h(organization)}</span><small>${h(location)}</small>${icon(ChevronRight)}</button>`;
        })
        .join("") || `<p class="ja-empty">${h(text.noResults)}</p>`
    }</div>`;
  }

  function searchBar(): string {
    return `<form class="ja-search" id="ja-search-form"><label>${h(text.search)}<input id="ja-search" value="${h(searchDraft)}" placeholder="${h(text.search)}" /></label><label>${h(text.location)}<input id="ja-location" value="${h(placeDraft)}" placeholder="${h(text.location)}" /></label><button class="ja-btn primary" type="submit">${icon(Search)}${h(text.go)}</button></form>`;
  }

  function publicDetail(): string {
    const item = active();
    if (!item)
      return `<div class="ja-detail ja-placeholder">${icon(BriefcaseBusiness)}<p>${h(text.noResults)}</p></div>`;
    if (item.kind === "official") {
      const record = item.record;
      return `<article class="ja-detail"><div class="ja-detail-head"><span class="ja-kicker">${h(text.officialFinder)}</span><h2>${h(record.title)}</h2><p class="ja-org">${h(record.publisher)} · ${h(record.jurisdiction.name)}</p><p>${h(record.summary)}</p></div><div class="ja-note">${h(text.officialNote)}</div><div class="ja-actions"><button class="ja-btn primary" data-action="prepare" data-id="${h(record.id)}">${h(text.prepare)}${icon(ArrowRight)}</button><a class="ja-btn" target="_blank" rel="noopener noreferrer" href="${h(record.sourceUrl)}">${h(text.openOfficial)}${icon(ArrowUpRight)}</a></div></article>`;
    }
    const posting = item.posting;
    const introduction = `<div class="ja-detail-head"><span class="ja-kicker">${h(posting.sample ? text.practice : text.inApp)}</span><h2>${h(posting.title)}</h2><p class="ja-org">${h(posting.organizationName)}${posting.location ? ` · ${h(posting.location)}` : ""}</p></div>`;
    const practice = posting.sample
      ? `<div class="ja-note">${h(text.practiceNote)}</div>`
      : "";
    if (step === "detail")
      return `<article class="ja-detail">${introduction}${practice}<section class="ja-section"><h3>${h(text.about)}</h3><p>${h(posting.description)}</p></section><div class="ja-actions"><button class="ja-btn primary" data-action="start">${h(options.token ? text.apply : text.signIn)}${icon(ArrowRight)}</button></div></article>`;
    if (step === "submitted")
      return `<article class="ja-detail">${introduction}<div class="ja-success">${icon(Check)}<h3>${h(text.submitted)}</h3><p>${h(notice)}</p><button class="ja-btn primary" data-action="mine">${h(text.mine)}${icon(ArrowRight)}</button></div></article>`;
    if (step === "review")
      return `<article class="ja-detail">${introduction}${practice}<section class="ja-section"><h3>${h(text.review)}</h3><div class="ja-answer"><span>${h(text.experience)}</span><strong>${h(experience)}</strong></div><div class="ja-answer"><span>${h(text.availability)}</span><strong>${h(availability)}</strong></div><div class="ja-answer"><span>${h(text.resume)}</span><strong>${h(resumes.find((r) => r.id === selectedResume)?.filename ?? text.noResume)}</strong></div><label class="ja-check"><input id="ja-confirm" type="checkbox" />${h(text.confirm)}</label>${posting.sample ? `<label class="ja-check"><input id="ja-practice" type="checkbox" />${h(text.practiceAgree)}</label>` : ""}${selectedResume ? `<label class="ja-check"><input id="ja-share" type="checkbox" />${h(text.share)}</label>` : ""}<div class="ja-actions"><button class="ja-btn" data-action="back-form">${h(text.back)}</button><button class="ja-btn primary" data-action="submit" ${busy ? "disabled" : ""}>${h(text.submit)}${icon(Send)}</button></div></section></article>`;
    return `<article class="ja-detail">${introduction}${practice}<section class="ja-section"><h3>${h(text.about)}</h3><p>${h(posting.description)}</p></section><section class="ja-section"><h3>${h(text.apply)}</h3><label class="ja-field">${h(text.experience)}<textarea id="ja-experience" rows="4" placeholder="${h(text.experienceHint)}">${h(experience)}</textarea></label><label class="ja-field">${h(text.availability)}<textarea id="ja-availability" rows="2" placeholder="${h(text.availabilityHint)}">${h(availability)}</textarea></label><div class="ja-resume"><div><strong>${h(text.resume)}</strong><small>${h(text.noAutomaticShare)}</small></div><select id="ja-resume" aria-label="${h(text.chooseResume)}"><option value="">${h(text.chooseResume)}</option>${resumes.map((resume) => `<option value="${h(resume.id)}" ${resume.id === selectedResume ? "selected" : ""}>${h(resume.filename)}</option>`).join("")}</select><label class="ja-upload">${icon(Upload)}${h(text.upload)}<input id="ja-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label>${selectedResume ? `<button class="ja-text-button" data-action="extract">${h(text.extract)}</button>` : `<button class="ja-text-button" data-action="profile">${h(text.profile)}</button>`}</div>${suggestion ? `<div class="ja-suggestion"><small>${h(text.sourceText)}</small><p>${h(suggestion.source)}</p><button class="ja-btn" data-action="use-suggestion">${h(text.use)}</button></div>` : ""}<div class="ja-actions"><button class="ja-btn" data-action="back-detail">${h(text.back)}</button><button class="ja-btn primary" data-action="review">${h(text.continue)}${icon(ArrowRight)}</button></div></section></article>`;
  }

  function mineList(): string {
    return `<div class="ja-list-head"><strong>${applications.length} ${h(applications.length === 1 ? text.application : text.applications)}</strong></div><div class="ja-result-list">${applications.map((application) => `<button class="ja-result ${selectedApplication === application.id ? "selected" : ""}" data-application="${h(application.id)}"><span class="ja-result-badge">${h(text.status[application.status])}${application.sample ? ` · ${h(text.practice)}` : ""}</span><strong>${h(application.postingTitle)}</strong><small>${h(date(application.updatedAt, options.locale))}</small>${icon(ChevronRight)}</button>`).join("") || `<p class="ja-empty">${h(text.noApplications)}</p>`}</div>`;
  }

  function mineDetail(): string {
    const application = activeApplication();
    if (!application)
      return `<div class="ja-detail ja-placeholder">${icon(FileText)}<p>${h(text.noApplications)}</p></div>`;
    return `<article class="ja-detail"><div class="ja-detail-head"><span class="ja-kicker">${h(text.status[application.status])}${application.sample ? ` · ${h(text.practice)}` : ""}</span><h2>${h(application.postingTitle)}</h2><p class="ja-org">${h(date(application.submittedAt, options.locale))}</p></div>${application.sample ? `<div class="ja-note">${h(text.practiceNote)}</div>` : ""}<section class="ja-section"><h3>${h(text.details)}</h3>${Object.entries(
      application.answers,
    )
      .map(
        ([key, value]) =>
          `<div class="ja-answer"><span>${h(key === "experience" ? text.experience : key === "availability" ? text.availability : key)}</span><strong>${h(value)}</strong></div>`,
      )
      .join(
        "",
      )}<div class="ja-resume"><strong>${h(text.resume)}</strong><select id="ja-resume" aria-label="${h(text.chooseResume)}"><option value="">${h(text.chooseResume)}</option>${resumes.map((resume) => `<option value="${h(resume.id)}" ${resume.id === selectedResume ? "selected" : ""}>${h(resume.filename)}</option>`).join("")}</select><button class="ja-btn" data-action="share-later">${h(text.share)}</button></div></section><section class="ja-section"><div class="ja-section-title"><h3>${h(text.updates)}</h3>${icon(MessageSquare)}</div><div class="ja-timeline">${messages.map((message) => `<div class="ja-message"><small>${h(message.author === "employer" ? text.employer : text.applicant)} · ${h(date(message.createdAt, options.locale))}</small><p>${h(message.body)}</p></div>`).join("") || `<p class="ja-empty">${h(text.noMessages)}</p>`}</div><div class="ja-compose"><textarea id="ja-message" rows="2" placeholder="${h(text.reply)}"></textarea><button class="ja-btn primary" data-action="send" aria-label="${h(text.send)}">${icon(Send)}</button></div></section></article>`;
  }

  function render(): void {
    if (loading) {
      root.innerHTML = `<p class="ja-loading">${h(text.loading)}</p>`;
      return;
    }
    const intro = `<div class="ja-intro"><h1>${h(view === "browse" ? text.browse : text.mine)}</h1></div>`;
    const alerts = `${error ? `<div class="ja-alert" role="alert">${h(error)} <button data-action="retry">${h(text.retry)}</button></div>` : ""}${notice && step !== "submitted" ? `<div class="ja-notice" role="status">${h(notice)}</div>` : ""}`;
    if (view === "mine" && !options.token) {
      root.innerHTML = `${intro}<div class="ja-gate"><h2>${h(text.signIn)}</h2><button class="ja-btn primary" data-action="sign-in">${h(text.signIn)}${icon(ArrowRight)}</button></div>`;
      return;
    }
    root.innerHTML = `${intro}${view === "browse" ? searchBar() : ""}${alerts}<div class="ja-split"><aside class="ja-rail">${view === "browse" ? resultList() : mineList()}</aside><div class="ja-main">${view === "browse" ? publicDetail() : mineDetail()}</div></div>`;
  }

  root.addEventListener("input", (event) => {
    const element = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (element.id === "ja-search") searchDraft = element.value;
    if (element.id === "ja-location") placeDraft = element.value;
    if (element.id === "ja-experience") experience = element.value;
    if (element.id === "ja-availability") availability = element.value;
  });
  root.addEventListener("submit", (event) => {
    if ((event.target as HTMLElement).id !== "ja-search-form") return;
    event.preventDefault();
    search = searchDraft.trim();
    place = placeDraft.trim();
    selected = "";
    render();
  });
  root.addEventListener("change", (event) => {
    const element = event.target as HTMLInputElement | HTMLSelectElement;
    if (element.id === "ja-resume") selectedResume = element.value;
    if (
      element.id === "ja-file" &&
      element instanceof HTMLInputElement &&
      element.files?.[0] &&
      options.token
    ) {
      const file = element.files[0];
      void perform(async () => {
        const resume = await applicationsApi.upload(options.token!, file);
        resumes.unshift(resume);
        selectedResume = resume.id;
        step = "form";
        notice = `${text.selected}: ${resume.filename}`;
      });
    }
  });
  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action],[data-result],[data-filter],[data-application]",
    );
    if (!target || busy) return;
    if (target.dataset.filter) {
      filter = target.dataset.filter as Filter;
      selected = "";
      step = "detail";
      render();
    }
    if (target.dataset.result) {
      selected = target.dataset.result;
      step = "detail";
      suggestion = null;
      render();
    }
    if (target.dataset.application) {
      selectedApplication = target.dataset.application;
      messages = [];
      render();
      void loadMessages().then(render);
    }
    const action = target.dataset.action;
    if (action === "retry") void load();
    if (action === "sign-in") options.onSignIn?.();
    if (action === "profile") options.onProfile?.();
    if (action === "prepare" && target.dataset.id)
      options.onPrepareExternal?.(target.dataset.id);
    if (action === "start") {
      if (!options.token) options.onSignIn?.();
      else {
        step = "form";
        render();
      }
    }
    if (action === "back-detail") {
      step = "detail";
      render();
    }
    if (action === "back-form") {
      step = "form";
      render();
    }
    if (action === "review") {
      if (!experience.trim() || !availability.trim()) {
        error = text.required;
        render();
      } else {
        error = "";
        step = "review";
        render();
      }
    }
    if (action === "extract" && options.token && selectedResume)
      void perform(async () => {
        const result = await applicationsApi.extract(
          options.token!,
          selectedResume,
        );
        const candidate = result.extraction.suggestions.find(
          (entry) => entry.field === "summary" || entry.field === "experience",
        );
        suggestion = candidate
          ? {
              value: Array.isArray(candidate.value)
                ? candidate.value.join("\n")
                : candidate.value,
              source: candidate.source.text,
            }
          : null;
        step = "form";
      });
    if (action === "use-suggestion" && suggestion) {
      experience = suggestion.value;
      suggestion = null;
      render();
    }
    if (action === "submit" && options.token) {
      const current = active();
      if (!current || current.kind !== "inApp") return;
      const confirmed =
        root.querySelector<HTMLInputElement>("#ja-confirm")?.checked;
      const practice =
        root.querySelector<HTMLInputElement>("#ja-practice")?.checked;
      if (!confirmed || (current.posting.sample && !practice)) {
        error = current.posting.sample ? text.practiceAgree : text.confirm;
        render();
        return;
      }
      const sharing =
        root.querySelector<HTMLInputElement>("#ja-share")?.checked;
      void perform(async () => {
        const application = await applicationsApi.submit(
          options.token!,
          current.posting.id,
          { experience: experience.trim(), availability: availability.trim() },
        );
        selectedApplication = application.id;
        applications.unshift(application);
        notice = text.submitted;
        step = "submitted";
        if (sharing && selectedResume) {
          try {
            await applicationsApi.shareResume(
              options.token!,
              application.id,
              selectedResume,
            );
          } catch {
            notice = text.shareFailed;
          }
        }
      });
    }
    if (action === "mine") {
      view = "mine";
      loading = false;
      void load();
    }
    if (action === "send" && options.token && selectedApplication) {
      const message = root
        .querySelector<HTMLTextAreaElement>("#ja-message")
        ?.value.trim();
      if (!message) return;
      void perform(async () => {
        messages.push(
          await applicationsApi.message(
            options.token!,
            selectedApplication,
            message,
          ),
        );
      });
    }
    if (
      action === "share-later" &&
      options.token &&
      selectedApplication &&
      selectedResume
    )
      void perform(async () => {
        await applicationsApi.shareResume(
          options.token!,
          selectedApplication,
          selectedResume,
        );
        notice = text.selected;
      });
  });

  void load();
  return root;
}
