import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  MessageSquare,
  Plus,
  Search,
  Send,
  X,
} from "lucide-static";
import { programsApi } from "./api.js";
import type {
  Program,
  ProgramApplication,
  ProgramIntakeOptions,
  ProgramMessage,
} from "./types.js";
import type { ProgramQuestion } from "@civicresolve/domain/program-intake";
import "./styles.css";

const labels = {
  en: {
    title: "Programs",
    find: "Find support",
    mine: "My requests",
    sponsor: "Sponsor workspace",
    sponsorAuthor: "Sponsor",
    you: "You",
    search: "Search programs",
    programSingular: "program",
    programPlural: "programs",
    empty: "No participating programs match this search.",
    choose: "Select a program to see the intake.",
    benefit: "Support",
    grant: "Funding",
    by: "Offered by",
    questions: "Your answers",
    continue: "Continue",
    review: "Review your request",
    confirm: "I have reviewed these answers",
    submit: "Send request",
    signin: "Sign in to continue",
    practice: "Practice workspace",
    practiceNote:
      "This request goes to an Envoy practice workspace. It does not reach a government program or provide a benefit.",
    practiceAgree: "I understand this is a practice request",
    submitted: "Request sent",
    return: "Back to programs",
    details: "Details",
    updates: "Updates",
    response: "Write a reply",
    send: "Send",
    status: "Status",
    create: "Create program",
    forms: "Programs",
    inbox: "Submissions",
    titleField: "Program name",
    summary: "Short description",
    type: "Type",
    fields: "Intake questions",
    field: "Question",
    shortAnswer: "Short answer",
    longAnswer: "Long answer",
    choice: "Choice",
    required: "Required",
    options: "Options, separated by commas",
    addField: "Add question",
    save: "Save draft",
    publish: "Publish",
    close: "Close intake",
    cancel: "Cancel",
    next: "Update status",
    noRequests: "No requests yet.",
    noPrograms: "Create a program to begin.",
    loading: "Loading…",
    retry: "Try again",
    received: "Received",
    noMessages: "No messages yet.",
    draft: "Draft",
    published: "Open",
    closed: "Closed",
    submittedStatus: "Submitted",
    under_review: "In review",
    information_requested: "More information needed",
    approved: "Approved by sponsor",
    declined: "Declined by sponsor",
    official:
      "Only participating sponsors can receive requests here. For external programs, continue on the publisher’s official site.",
  },
  fr: {
    title: "Programmes",
    find: "Trouver de l’aide",
    mine: "Mes demandes",
    sponsor: "Espace du promoteur",
    sponsorAuthor: "Promoteur",
    you: "Vous",
    search: "Rechercher des programmes",
    programSingular: "programme",
    programPlural: "programmes",
    empty: "Aucun programme participant ne correspond.",
    choose: "Choisissez un programme pour voir le formulaire.",
    benefit: "Soutien",
    grant: "Financement",
    by: "Offert par",
    questions: "Vos réponses",
    continue: "Continuer",
    review: "Vérifiez votre demande",
    confirm: "J’ai vérifié ces réponses",
    submit: "Envoyer la demande",
    signin: "Se connecter pour continuer",
    practice: "Espace d’exercice",
    practiceNote:
      "Cette demande va à un espace d’exercice d’Envoy. Elle ne parvient à aucun programme gouvernemental et ne fournit aucune prestation.",
    practiceAgree: "Je comprends qu’il s’agit d’une demande d’exercice",
    submitted: "Demande envoyée",
    return: "Retour aux programmes",
    details: "Détails",
    updates: "Mises à jour",
    response: "Écrire une réponse",
    send: "Envoyer",
    status: "Statut",
    create: "Créer un programme",
    forms: "Programmes",
    inbox: "Demandes",
    titleField: "Nom du programme",
    summary: "Brève description",
    type: "Type",
    fields: "Questions du formulaire",
    field: "Question",
    shortAnswer: "Réponse courte",
    longAnswer: "Réponse longue",
    choice: "Choix",
    required: "Obligatoire",
    options: "Options séparées par des virgules",
    addField: "Ajouter une question",
    save: "Enregistrer le brouillon",
    publish: "Publier",
    close: "Fermer le formulaire",
    cancel: "Annuler",
    next: "Mettre à jour",
    noRequests: "Aucune demande.",
    noPrograms: "Créez un programme pour commencer.",
    loading: "Chargement…",
    retry: "Réessayer",
    received: "Reçue",
    noMessages: "Aucun message.",
    draft: "Brouillon",
    published: "Ouvert",
    closed: "Fermé",
    submittedStatus: "Soumise",
    under_review: "À l’étude",
    information_requested: "Renseignements demandés",
    approved: "Approuvée par le promoteur",
    declined: "Refusée par le promoteur",
    official:
      "Seuls les promoteurs participants reçoivent les demandes ici. Pour les programmes externes, continuez sur le site officiel de l’éditeur.",
  },
} as const;

const icon = (svg: string) =>
  `<span class="pi-icon" aria-hidden="true">${svg}</span>`;
const h = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const date = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export function createProgramIntakePage(
  options: ProgramIntakeOptions,
): HTMLElement {
  const text = labels[options.locale];
  const root = document.createElement("section");
  root.className = "program-intake";
  let programs: Program[] = [];
  let applications: ProgramApplication[] = [];
  let messages: ProgramMessage[] = [];
  let selectedProgram = "";
  let selectedApplication = "";
  let search = "";
  let loading = true;
  let busy = false;
  let error = "";
  let notice = "";
  let review = false;
  let editing = false;
  let sponsorTab: "forms" | "inbox" = "forms";
  let draft: Pick<Program, "kind" | "title" | "summary" | "questions"> =
    blankDraft();
  let draftProgramId = "";
  let answers: Record<string, string> = {};

  const selected = () =>
    programs.find((item) => item.id === selectedProgram) ?? null;
  const selectedRequest = () =>
    applications.find((item) => item.id === selectedApplication) ?? null;

  async function load(): Promise<void> {
    loading = true;
    error = "";
    render();
    try {
      if (options.view === "discover") {
        programs = (await programsApi.list()).programs;
        selectedProgram ||= programs[0]?.id ?? "";
      } else if (options.view === "mine") {
        applications = options.token
          ? (await programsApi.listMine(options.token)).applications
          : [];
        selectedApplication ||= applications[0]?.id ?? "";
        if (selectedApplication) await loadMessages();
      } else if (options.token && options.organizationId) {
        const [forms, inbox] = await Promise.all([
          programsApi.staffPrograms(options.token, options.organizationId),
          programsApi.staffApplications(options.token, options.organizationId),
        ]);
        programs = forms.programs;
        applications = inbox.applications;
        selectedProgram ||= programs[0]?.id ?? "";
        selectedApplication ||= applications[0]?.id ?? "";
        if (selectedApplication) await loadMessages();
      }
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Unable to load programs.";
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
      messages =
        options.view === "sponsor" && options.organizationId
          ? (
              await programsApi.staffMessages(
                options.token,
                options.organizationId,
                selectedApplication,
              )
            ).messages
          : (await programsApi.ownMessages(options.token, selectedApplication))
              .messages;
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
      error = cause instanceof Error ? cause.message : "Request failed.";
    } finally {
      busy = false;
      render();
    }
  }

  function shell(content: string): string {
    const tabs =
      options.view === "sponsor"
        ? `<div class="pi-tabs"><button data-action="forms" class="${sponsorTab === "forms" ? "active" : ""}">${h(text.forms)}</button><button data-action="inbox" class="${sponsorTab === "inbox" ? "active" : ""}">${h(text.inbox)} <span>${applications.length}</span></button></div>`
        : "";
    return `<div class="pi-top"><div class="pi-title-row"><h1>${h(options.view === "sponsor" ? text.sponsor : options.view === "mine" ? text.mine : text.find)}</h1>${options.view === "sponsor" && sponsorTab === "forms" ? `<button class="pi-btn primary" data-action="new">${icon(Plus)}${h(text.create)}</button>` : ""}</div>${tabs}</div>${error ? `<div role="alert" class="pi-alert">${h(error)} <button data-action="retry">${h(text.retry)}</button></div>` : ""}${notice ? `<div role="status" class="pi-notice">${icon(Check)}${h(notice)}</div>` : ""}${content}</div>`;
  }

  function programList(): string {
    const visible = programs.filter((item) =>
      `${item.title} ${item.summary} ${item.sponsor}`
        .toLowerCase()
        .includes(search),
    );
    return `<div class="pi-list-head"><label class="pi-search">${icon(Search)}<input id="pi-search" type="search" aria-label="${h(text.search)}" placeholder="${h(text.search)}" value="${h(search)}" /></label><span class="pi-result-count">${visible.length} ${h(visible.length === 1 ? text.programSingular : text.programPlural)}</span></div><div class="pi-list">${visible.map((item) => `<button class="pi-list-row ${selectedProgram === item.id ? "selected" : ""}" data-action="select-program" data-id="${h(item.id)}"><span class="pi-row-category">${h(item.kind === "grant" ? text.grant : text.benefit)}${item.sample ? ` · ${h(text.practice)}` : ""}</span><strong>${h(item.title)}</strong><span class="pi-row-meta">${h(item.sponsor)}</span>${icon(ChevronRight)}</button>`).join("") || `<p class="pi-empty">${h(text.empty)}</p>`}</div>`;
  }

  function questionInputs(program: Program): string {
    return program.questions
      .map((question, index) => {
        const label = `<label for="pi-answer-${h(question.id)}">${h(question.label)}${question.required ? ' <span class="pi-required">*</span>' : ""}</label>`;
        const value = answers[question.id] ?? "";
        const control =
          question.type === "long_text"
            ? `<textarea id="pi-answer-${h(question.id)}" data-question="${h(question.id)}" rows="4">${h(value)}</textarea>`
            : question.type === "select"
              ? `<select id="pi-answer-${h(question.id)}" data-question="${h(question.id)}"><option value=""></option>${(question.options ?? []).map((option) => `<option value="${h(option)}" ${option === value ? "selected" : ""}>${h(option)}</option>`).join("")}</select>`
              : `<input id="pi-answer-${h(question.id)}" data-question="${h(question.id)}" value="${h(value)}" />`;
        return `<div class="pi-field"><span class="pi-field-number">${String(index + 1).padStart(2, "0")}</span><div>${label}${control}</div></div>`;
      })
      .join("");
  }

  function publicDetail(): string {
    const program = selected();
    if (!program)
      return `<div class="pi-detail pi-placeholder">${icon(CircleHelp)}<p>${h(text.choose)}</p></div>`;
    return `<article class="pi-detail"><div class="pi-detail-head"><span class="pi-eyebrow">${h(program.kind === "grant" ? text.grant : text.benefit)}${program.sample ? ` · ${h(text.practice)}` : ""}</span><h2>${h(program.title)}</h2><p>${h(program.summary)}</p><div class="pi-by">${h(text.by)} <strong>${h(program.sponsor)}</strong></div></div>${program.sample ? `<div class="pi-practice">${icon(CircleHelp)}<p>${h(text.practiceNote)}</p></div>` : ""}${
      review
        ? `<div class="pi-review"><h3>${h(text.review)}</h3>${program.questions
            .filter((q) => answers[q.id])
            .map(
              (q) =>
                `<div class="pi-answer"><span>${h(q.label)}</span><strong>${h(answers[q.id])}</strong></div>`,
            )
            .join(
              "",
            )}<label class="pi-check"><input id="pi-confirm" type="checkbox" />${h(text.confirm)}</label>${program.sample ? `<label class="pi-check"><input id="pi-sandbox" type="checkbox" />${h(text.practiceAgree)}</label>` : ""}<div class="pi-actions"><button class="pi-btn" data-action="back-form">${h(text.cancel)}</button><button class="pi-btn primary" data-action="submit" ${busy ? "disabled" : ""}>${icon(Send)}${h(text.submit)}</button></div></div>`
        : `<div class="pi-form"><h3>${h(text.questions)}</h3>${questionInputs(program)}<div class="pi-actions">${!options.token ? `<button class="pi-btn primary" data-action="sign-in">${h(text.signin)}${icon(ArrowRight)}</button>` : `<button class="pi-btn primary" data-action="review">${h(text.continue)}${icon(ArrowRight)}</button>`}</div></div>`
    }</article>`;
  }

  function requestList(): string {
    return `<div class="pi-list-head"><span>${h(text.received)}</span><span>${applications.length}</span></div><div class="pi-list">${applications.map((item) => `<button class="pi-list-row ${selectedApplication === item.id ? "selected" : ""}" data-action="select-request" data-id="${h(item.id)}"><span class="pi-row-category">${h(statusLabel(item.status))}${item.sample ? ` · ${h(text.practice)}` : ""}</span><strong>${h(item.programTitle)}</strong><span class="pi-row-meta">${h(date(item.submittedAt, options.locale))}</span>${icon(ChevronRight)}</button>`).join("") || `<p class="pi-empty">${h(text.noRequests)}</p>`}</div>`;
  }

  function statusLabel(status: ProgramApplication["status"]): string {
    return status === "submitted" ? text.submittedStatus : text[status];
  }

  function nextStatuses(
    status: ProgramApplication["status"],
  ): ProgramApplication["status"][] {
    if (status === "submitted")
      return ["under_review", "information_requested"];
    if (status === "under_review")
      return ["information_requested", "approved", "declined"];
    if (status === "information_requested") return ["under_review", "declined"];
    return [];
  }

  function requestDetail(): string {
    const application = selectedRequest();
    if (!application)
      return `<div class="pi-detail pi-placeholder">${icon(FileText)}<p>${h(text.noRequests)}</p></div>`;
    return `<article class="pi-detail"><div class="pi-detail-head"><span class="pi-eyebrow">${h(statusLabel(application.status))}${application.sample ? ` · ${h(text.practice)}` : ""}</span><h2>${h(application.programTitle)}</h2><p>${h(date(application.submittedAt, options.locale))}</p></div>${application.sample ? `<div class="pi-practice">${icon(CircleHelp)}<p>${h(text.practiceNote)}</p></div>` : ""}<section class="pi-section"><div class="pi-section-title"><h3>${h(text.details)}</h3>${
      options.view === "sponsor" && nextStatuses(application.status).length
        ? `<label class="pi-status-control"><span>${h(text.status)}</span><select id="pi-status"><option value="">${h(text.next)}</option>${nextStatuses(
            application.status,
          )
            .map(
              (status) =>
                `<option value="${h(status)}">${h(statusLabel(status))}</option>`,
            )
            .join("")}</select></label>`
        : ""
    }</div>${Object.entries(application.answers)
      .map(
        ([key, value]) =>
          `<div class="pi-answer"><span>${h(application.questions.find((question) => question.id === key)?.label ?? key.replaceAll("_", " "))}</span><strong>${h(value)}</strong></div>`,
      )
      .join(
        "",
      )}</section><section class="pi-section"><div class="pi-section-title"><h3>${h(text.updates)}</h3>${icon(MessageSquare)}</div><div class="pi-timeline">${messages.map((message) => `<div class="pi-message"><span>${h(message.author === "sponsor" ? text.sponsorAuthor : text.you)} · ${h(date(message.createdAt, options.locale))}</span><p>${h(message.body)}</p></div>`).join("") || `<p class="pi-empty">${h(text.noMessages)}</p>`}</div><div class="pi-compose"><textarea id="pi-message" rows="2" placeholder="${h(text.response)}"></textarea><button class="pi-btn primary" data-action="send-message" ${busy ? "disabled" : ""} aria-label="${h(text.send)}">${icon(Send)}</button></div></section></article>`;
  }

  function formEditor(): string {
    return `<div class="pi-editor"><div class="pi-editor-head"><h2>${h(draftProgramId ? text.details : text.create)}</h2><button data-action="cancel-edit" class="pi-icon-button" aria-label="${h(text.cancel)}">${icon(X)}</button></div><div class="pi-editor-grid"><label>${h(text.type)}<select id="pi-kind"><option value="benefit" ${draft.kind === "benefit" ? "selected" : ""}>${h(text.benefit)}</option><option value="grant" ${draft.kind === "grant" ? "selected" : ""}>${h(text.grant)}</option></select></label><label>${h(text.titleField)}<input id="pi-title" value="${h(draft.title)}" maxlength="160" /></label></div><label>${h(text.summary)}<textarea id="pi-summary" rows="3" maxlength="4000">${h(draft.summary)}</textarea></label><div class="pi-section-title"><h3>${h(text.fields)}</h3><button class="pi-btn" data-action="add-question">${icon(Plus)}${h(text.addField)}</button></div><div class="pi-questions">${draft.questions.map((q, index) => `<div class="pi-question" data-index="${index}"><div class="pi-question-top"><span>${String(index + 1).padStart(2, "0")}</span><button class="pi-icon-button" data-action="remove-question" data-index="${index}" aria-label="${h(text.cancel)}">${icon(X)}</button></div><label>${h(text.field)}<input data-field="label" value="${h(q.label)}" maxlength="160" /></label><div class="pi-editor-grid"><label>${h(text.type)}<select data-field="type"><option value="short_text" ${q.type === "short_text" ? "selected" : ""}>${h(text.shortAnswer)}</option><option value="long_text" ${q.type === "long_text" ? "selected" : ""}>${h(text.longAnswer)}</option><option value="select" ${q.type === "select" ? "selected" : ""}>${h(text.choice)}</option></select></label><label class="pi-check"><input type="checkbox" data-field="required" ${q.required ? "checked" : ""} />${h(text.required)}</label></div><label>${h(text.options)}<input data-field="options" value="${h(q.options?.join(", ") ?? "")}" /></label></div>`).join("")}</div><div class="pi-actions"><button class="pi-btn" data-action="cancel-edit">${h(text.cancel)}</button><button class="pi-btn primary" data-action="save-program" ${busy ? "disabled" : ""}>${h(text.save)}</button></div></div>`;
  }

  function sponsorPrograms(): string {
    const program = selected();
    return `<div class="pi-split"><aside class="pi-rail">${programList()}</aside><div class="pi-main">${editing ? formEditor() : program ? `<article class="pi-detail"><div class="pi-detail-head"><span class="pi-eyebrow">${h(program.kind === "grant" ? text.grant : text.benefit)} · ${h(text[program.status])}${program.sample ? ` · ${h(text.practice)}` : ""}</span><h2>${h(program.title)}</h2><p>${h(program.summary)}</p><div class="pi-by">${h(text.by)} <strong>${h(program.sponsor)}</strong></div></div>${program.sample ? `<div class="pi-practice">${icon(CircleHelp)}<p>${h(text.practiceNote)}</p></div>` : ""}<div class="pi-section"><div class="pi-section-title"><h3>${h(text.fields)}</h3><span>${program.questions.length}</span></div>${program.questions.map((q, i) => `<div class="pi-answer"><span>${String(i + 1).padStart(2, "0")}</span><strong>${h(q.label)}</strong></div>`).join("")}</div><div class="pi-actions">${program.status === "draft" ? `<button class="pi-btn" data-action="edit-program">${h(text.details)}</button><button class="pi-btn primary" data-action="publish-program">${h(text.publish)}${icon(ArrowRight)}</button>` : program.status === "published" ? `<button class="pi-btn" data-action="close-program">${h(text.close)}</button>` : ""}</div></article>` : `<div class="pi-detail pi-placeholder"><p>${h(text.noPrograms)}</p></div>`}</div></div>`;
  }

  function readDraft(): void {
    const kind = root.querySelector<HTMLSelectElement>("#pi-kind")?.value;
    const title =
      root.querySelector<HTMLInputElement>("#pi-title")?.value ?? "";
    const summary =
      root.querySelector<HTMLTextAreaElement>("#pi-summary")?.value ?? "";
    const questions: ProgramQuestion[] = [];
    root.querySelectorAll<HTMLElement>(".pi-question").forEach((row, index) => {
      const label =
        row.querySelector<HTMLInputElement>('[data-field="label"]')?.value ??
        "";
      const type =
        (row.querySelector<HTMLSelectElement>('[data-field="type"]')
          ?.value as ProgramQuestion["type"]) ?? "short_text";
      const required =
        row.querySelector<HTMLInputElement>('[data-field="required"]')
          ?.checked ?? false;
      const options = (
        row.querySelector<HTMLInputElement>('[data-field="options"]')?.value ??
        ""
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      questions.push({
        id: draft.questions[index]?.id ?? `question_${index + 1}`,
        label,
        type,
        required,
        ...(type === "select" ? { options } : {}),
      });
    });
    draft = {
      kind: kind === "grant" ? "grant" : "benefit",
      title,
      summary,
      questions,
    };
  }

  function render(): void {
    if (loading) {
      root.innerHTML = shell(
        `<div class="pi-loading">${h(text.loading)}</div>`,
      );
      return;
    }
    if (!options.token && options.view !== "discover") {
      root.innerHTML = shell(
        `<div class="pi-gate"><div class="pi-gate-icon">${icon(FileText)}</div><h2>${h(text.signin)}</h2><button class="pi-btn primary" data-action="sign-in">${h(text.signin)}${icon(ArrowRight)}</button></div>`,
      );
      return;
    }
    const content =
      options.view === "discover"
        ? `<div class="pi-split"><aside class="pi-rail">${programList()}</aside><div class="pi-main">${publicDetail()}</div></div><p class="pi-footnote">${h(text.official)}</p>`
        : options.view === "mine" || sponsorTab === "inbox"
          ? `<div class="pi-split"><aside class="pi-rail">${requestList()}</aside><div class="pi-main">${requestDetail()}</div></div>`
          : sponsorPrograms();
    root.innerHTML = shell(content);
  }

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (target.id === "pi-search") {
      search = (target as HTMLInputElement).value.toLowerCase();
      const position = (target as HTMLInputElement).selectionStart;
      render();
      const input = root.querySelector<HTMLInputElement>("#pi-search");
      input?.focus();
      if (position !== null) input?.setSelectionRange(position, position);
    }
    const question = target.getAttribute("data-question");
    if (question)
      answers[question] = (
        target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      ).value;
  });
  root.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    if (target.id === "pi-status") {
      const status = (target as HTMLSelectElement)
        .value as ProgramApplication["status"];
      if (
        status &&
        options.token &&
        options.organizationId &&
        selectedApplication
      )
        void perform(async () => {
          const result = await programsApi.staffStatus(
            options.token!,
            options.organizationId!,
            selectedApplication,
            status,
          );
          applications = applications.map((item) =>
            item.id === result.application.id ? result.application : item,
          );
        });
    }
    const question = target.getAttribute("data-question");
    if (question) answers[question] = (target as HTMLSelectElement).value;
  });
  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    if (!target || busy) return;
    const action = target.dataset.action;
    if (action === "retry") void load();
    if (action === "sign-in") options.onSignIn?.();
    if (action === "forms" || action === "inbox") {
      sponsorTab = action;
      editing = false;
      render();
    }
    if (action === "select-program") {
      selectedProgram = target.dataset.id ?? "";
      answers = {};
      review = false;
      editing = false;
      render();
    }
    if (action === "select-request") {
      selectedApplication = target.dataset.id ?? "";
      messages = [];
      render();
      void loadMessages().then(render);
    }
    if (action === "review") {
      review = true;
      render();
    }
    if (action === "back-form") {
      review = false;
      render();
    }
    if (action === "submit" && options.token && selectedProgram) {
      const confirmed =
        root.querySelector<HTMLInputElement>("#pi-confirm")?.checked;
      const sandbox =
        root.querySelector<HTMLInputElement>("#pi-sandbox")?.checked;
      if (!confirmed || (selected()?.sample && !sandbox)) {
        error = selected()?.sample ? text.practiceAgree : text.confirm;
        render();
        return;
      }
      void perform(async () => {
        const body = {
          programId: selectedProgram,
          answers,
          confirmedByApplicant: true as const,
          ...(selected()?.sample ? { sandboxAcknowledged: true as const } : {}),
        };
        const result = await programsApi.submit(options.token!, body);
        review = false;
        answers = {};
        selectedApplication = result.application.id;
        notice = text.submitted;
      });
    }
    if (action === "send-message" && options.token && selectedApplication) {
      const message = root
        .querySelector<HTMLTextAreaElement>("#pi-message")
        ?.value.trim();
      if (!message) return;
      void perform(async () => {
        const result =
          options.view === "sponsor" && options.organizationId
            ? await programsApi.staffMessage(
                options.token!,
                options.organizationId,
                selectedApplication,
                message,
              )
            : await programsApi.ownMessage(
                options.token!,
                selectedApplication,
                message,
              );
        messages.push(result.message);
      });
    }
    if (action === "new") {
      draft = blankDraft();
      draftProgramId = "";
      editing = true;
      render();
    }
    if (action === "edit-program") {
      const program = selected();
      if (!program) return;
      draft = {
        kind: program.kind,
        title: program.title,
        summary: program.summary,
        questions: structuredClone(program.questions),
      };
      draftProgramId = program.id;
      editing = true;
      render();
    }
    if (action === "cancel-edit") {
      editing = false;
      render();
    }
    if (action === "add-question") {
      readDraft();
      draft.questions.push({
        id: `question_${crypto.randomUUID().slice(0, 8)}`,
        label: "",
        type: "short_text",
        required: true,
      });
      render();
    }
    if (action === "remove-question") {
      readDraft();
      draft.questions.splice(Number(target.dataset.index), 1);
      render();
    }
    if (action === "save-program" && options.token && options.organizationId) {
      readDraft();
      void perform(async () => {
        const result = draftProgramId
          ? await programsApi.staffEdit(
              options.token!,
              options.organizationId!,
              draftProgramId,
              draft,
            )
          : await programsApi.staffCreate(
              options.token!,
              options.organizationId!,
              draft,
            );
        const index = programs.findIndex(
          (item) => item.id === result.program.id,
        );
        if (index >= 0) programs[index] = result.program;
        else programs.unshift(result.program);
        selectedProgram = result.program.id;
        editing = false;
      });
    }
    if (
      (action === "publish-program" || action === "close-program") &&
      options.token &&
      options.organizationId &&
      selectedProgram
    ) {
      void perform(async () => {
        const result = await programsApi.staffState(
          options.token!,
          options.organizationId!,
          selectedProgram,
          action === "publish-program" ? "publish" : "close",
        );
        programs = programs.map((item) =>
          item.id === result.program.id ? result.program : item,
        );
      });
    }
  });

  void load();
  return root;
}

function blankDraft(): Pick<
  Program,
  "kind" | "title" | "summary" | "questions"
> {
  return {
    kind: "benefit",
    title: "",
    summary: "",
    questions: [
      { id: "request", label: "", type: "long_text", required: true },
    ],
  };
}
