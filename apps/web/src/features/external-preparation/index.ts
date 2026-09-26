import type { Locale } from "@civicresolve/contracts/v1";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronLeft,
  FileText,
  LibraryBig,
  Plus,
  Save,
  Trash2,
} from "lucide-static";
import "./styles.css";

interface Answer {
  id: string;
  question: string;
  response: string;
}
interface Step {
  id: string;
  text: string;
  done: boolean;
}
interface Preparation {
  answers: Answer[];
  checklist: Step[];
  status: "prepared-for-external";
}
interface ReusableAnswer {
  id: string;
  label: string;
  response: string;
}
interface OfficialRecord {
  id: string;
  title: string;
  summary: string;
  publisher: string;
  jurisdiction: string;
  officialUrl: string;
  verifiedAt: string | null;
  freshness: string;
  purpose: "application" | "participation";
}
interface PreparationResponse {
  record: OfficialRecord;
  preparation: Preparation;
  saved: boolean;
  updatedAt: string | null;
  externalSubmissionRecorded: false;
}

interface Options {
  recordId: string;
  locale: Locale;
  token: string | null;
  onBack?: () => void;
  onSignIn?: () => void;
}

const API = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

const copy = {
  en: {
    back: "Back to results",
    source: "Official source",
    prepared: "Prepared for external application",
    description:
      "Bring your answers together, then finish on the publisher’s site.",
    questions: "Your answers",
    addQuestion: "Add answer",
    question: "Question or requirement",
    questionPlaceholder: "What does the application ask?",
    answer: "Your answer",
    answerPlaceholder: "Write your answer here",
    checklist: "Your checklist",
    addStep: "Add step",
    stepPlaceholder: "What do you need to do?",
    save: "Save preparation",
    saving: "Saving…",
    saved: "Saved",
    download: "Download notes",
    open: "Continue on official site",
    officialHint:
      "Check the latest requirements there. Envoy has not submitted an application.",
    guest: "Sign in to keep these notes across devices.",
    signIn: "Sign in",
    reusable: "Saved answers",
    saveAnswer: "Save as reusable",
    useAnswer: "Use a saved answer",
    noReusable: "Saved answers appear here once you create one.",
    use: "Use",
    remove: "Remove",
    saveFirst: "Sign in to save reusable answers.",
    loading: "Opening preparation…",
    unavailable: "This official record is unavailable.",
    retry: "Try again",
    modified: "Unsaved changes",
    sourceReviewed: "Source reviewed",
    verify: "Verify on publisher site",
    complete: "Complete on official site",
    noSubmit: "This workspace does not submit an application.",
  },
  fr: {
    back: "Retour aux résultats",
    source: "Source officielle",
    prepared: "Préparé pour une demande externe",
    description:
      "Rassemblez vos réponses, puis terminez sur le site de l’éditeur.",
    questions: "Vos réponses",
    addQuestion: "Ajouter une réponse",
    question: "Question ou exigence",
    questionPlaceholder: "Que demande le formulaire?",
    answer: "Votre réponse",
    answerPlaceholder: "Écrivez votre réponse ici",
    checklist: "Votre liste",
    addStep: "Ajouter une étape",
    stepPlaceholder: "Que devez-vous faire?",
    save: "Enregistrer la préparation",
    saving: "Enregistrement…",
    saved: "Enregistré",
    download: "Télécharger les notes",
    open: "Continuer sur le site officiel",
    officialHint:
      "Vérifiez les exigences actuelles. Envoy n’a soumis aucune demande.",
    guest: "Connectez-vous pour conserver ces notes sur vos appareils.",
    signIn: "Connexion",
    reusable: "Réponses enregistrées",
    saveAnswer: "Réutiliser plus tard",
    useAnswer: "Utiliser une réponse enregistrée",
    noReusable: "Vos réponses enregistrées apparaîtront ici.",
    use: "Utiliser",
    remove: "Supprimer",
    saveFirst: "Connectez-vous pour enregistrer des réponses réutilisables.",
    loading: "Ouverture de la préparation…",
    unavailable: "Ce dossier officiel est indisponible.",
    retry: "Réessayer",
    modified: "Modifications non enregistrées",
    sourceReviewed: "Source examinée",
    verify: "Vérifiez sur le site de l’éditeur",
    complete: "Terminer sur le site officiel",
    noSubmit: "Cet espace ne soumet aucune demande.",
  },
} as const;

const participationCopy = {
  en: {
    prepared: "Prepared for external participation",
    description:
      "Bring your thoughts together, then contribute on the publisher’s site.",
    questions: "Your contributions",
    addQuestion: "Add point",
    question: "Topic or prompt",
    questionPlaceholder: "What would you like to contribute?",
    answer: "Your contribution",
    answerPlaceholder: "Write your thoughts here",
    officialHint:
      "Check the latest details there. Envoy has not sent a contribution.",
    complete: "Participate on official site",
    noSubmit: "This workspace does not submit a contribution.",
  },
  fr: {
    prepared: "Préparé pour une participation externe",
    description:
      "Rassemblez vos idées, puis contribuez sur le site de l’éditeur.",
    questions: "Vos contributions",
    addQuestion: "Ajouter une idée",
    question: "Sujet ou question",
    questionPlaceholder: "Qu’aimeriez-vous apporter?",
    answer: "Votre contribution",
    answerPlaceholder: "Écrivez vos idées ici",
    officialHint:
      "Vérifiez les renseignements actuels. Envoy n’a envoyé aucune contribution.",
    complete: "Participer sur le site officiel",
    noSubmit: "Cet espace ne soumet aucune contribution.",
  },
} as const;

export function createExternalPreparationPage({
  recordId,
  locale,
  token,
  onBack,
  onSignIn,
}: Options): HTMLElement {
  const t = copy[locale];
  const root = node("section", "external-prep");
  let record: OfficialRecord | null = null;
  let preparation: Preparation = {
    answers: [],
    checklist: [],
    status: "prepared-for-external",
  };
  let reusable: ReusableAnswer[] = [];
  let pending = false;
  let dirty = false;
  let libraryOpen = false;
  let libraryTargetId: string | null = null;
  let notice = "";
  let error = "";
  const wording = () =>
    record?.purpose === "participation"
      ? { ...t, ...participationCopy[locale] }
      : t;

  async function load(): Promise<void> {
    root.replaceChildren(node("p", "external-prep-loading", t.loading));
    try {
      const result = await request<PreparationResponse>(
        `/external-preparations/${encodeURIComponent(recordId)}`,
        token,
      );
      record = result.record;
      preparation = result.preparation;
      if (token) {
        const library = await request<{ answers: ReusableAnswer[] }>(
          "/external-preparations/answers",
          token,
        ).catch(() => null);
        reusable = library?.answers ?? [];
      }
      error = "";
    } catch (cause) {
      error = message(cause);
    }
    render();
  }

  function render(): void {
    root.replaceChildren();
    if (!record) {
      root.append(node("p", "external-prep-loading", error || t.unavailable));
      root.append(button(t.retry, "external-prep-button", () => void load()));
      return;
    }
    const content = wording();
    const nav = node("div", "external-prep-nav");
    if (onBack)
      nav.append(
        buttonWithIcon(ChevronLeft, t.back, "external-prep-back", onBack),
      );
    nav.append(node("span", "external-prep-status", content.prepared));
    root.append(nav);

    const header = node("header", "external-prep-header");
    header.append(
      node("h1", "", record.title),
      node("p", "", content.description),
    );
    root.append(header);

    const layout = node("div", "external-prep-layout");
    const editor = node("main", "external-prep-editor");
    const answersHeading = node("div", "external-prep-section-heading");
    answersHeading.append(
      node("h2", "", content.questions),
      buttonWithIcon(
        Plus,
        content.addQuestion,
        "external-prep-text-button",
        () => {
          preparation.answers.push({ id: uid(), question: "", response: "" });
          dirty = true;
          render();
        },
      ),
    );
    editor.append(answersHeading);
    if (preparation.answers.length === 0) {
      const blank = node("div", "external-prep-blank");
      blank.append(icon(FileText), node("p", "", content.questionPlaceholder));
      editor.append(blank);
    }
    for (const answer of preparation.answers)
      editor.append(answerEditor(answer));

    const stepsHeading = node(
      "div",
      "external-prep-section-heading external-prep-steps-heading",
    );
    stepsHeading.append(
      node("h2", "", t.checklist),
      buttonWithIcon(Plus, t.addStep, "external-prep-text-button", () => {
        preparation.checklist.push({ id: uid(), text: "", done: false });
        dirty = true;
        render();
      }),
    );
    editor.append(stepsHeading);
    for (const step of preparation.checklist) editor.append(stepEditor(step));
    if (preparation.checklist.length === 0)
      editor.append(node("p", "external-prep-help", t.stepPlaceholder));

    const actionRow = node("div", "external-prep-actions");
    if (token) {
      const saveButton = buttonWithIcon(
        Save,
        pending ? t.saving : t.save,
        "external-prep-button external-prep-button-primary",
        () => void save(),
      );
      saveButton.disabled = pending;
      actionRow.append(saveButton);
    } else {
      const signIn = button(
        t.signIn,
        "external-prep-button external-prep-button-primary",
        () => onSignIn?.(),
      );
      if (onSignIn) actionRow.append(signIn);
    }
    actionRow.append(
      buttonWithIcon(
        ArrowDownToLine,
        t.download,
        "external-prep-button",
        download,
      ),
    );
    editor.append(actionRow);
    if (!token) editor.append(node("p", "external-prep-help", t.guest));
    else if (dirty) editor.append(node("p", "external-prep-help", t.modified));
    else if (notice) editor.append(node("p", "external-prep-success", notice));
    if (error) editor.append(node("p", "external-prep-error", error));

    const aside = node("aside", "external-prep-aside");
    aside.append(node("span", "external-prep-label", t.source));
    aside.append(
      node("h2", "", record.publisher),
      node("p", "external-prep-jurisdiction", record.jurisdiction),
    );
    if (record.verifiedAt) {
      const date = new Date(record.verifiedAt).toLocaleDateString(locale);
      aside.append(
        node("p", "external-prep-source-date", `${t.sourceReviewed} ${date}`),
      );
    }
    if (record.freshness !== "current")
      aside.append(node("p", "external-prep-source-date", t.verify));
    const link = node("a", "external-prep-official-link");
    link.href = record.officialUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.append(document.createTextNode(t.open), icon(ArrowUpRight));
    aside.append(
      link,
      node("p", "external-prep-source-note", content.officialHint),
    );
    const marker = node("div", "external-prep-sequence");
    marker.append(
      node("span", "is-complete", content.prepared),
      node("span", "", content.complete),
    );
    aside.append(
      marker,
      node("p", "external-prep-source-note", content.noSubmit),
    );
    layout.append(editor, aside);
    root.append(layout);
    if (libraryOpen) root.append(libraryPanel());
  }

  function answerEditor(answer: Answer): HTMLElement {
    const content = wording();
    const card = node("div", "external-prep-answer");
    const top = node("div", "external-prep-answer-top");
    top.append(
      buttonWithIcon(
        LibraryBig,
        t.useAnswer,
        "external-prep-subtle-button",
        () => {
          libraryTargetId = answer.id;
          libraryOpen = true;
          render();
        },
      ),
    );
    top.append(
      buttonWithIcon(Trash2, t.remove, "external-prep-icon-button", () => {
        preparation.answers = preparation.answers.filter(
          (candidate) => candidate.id !== answer.id,
        );
        dirty = true;
        render();
      }),
    );
    card.append(top);
    const question = labeledInput(
      content.question,
      content.questionPlaceholder,
      answer.question,
      (value) => {
        answer.question = value;
        dirty = true;
      },
    );
    const response = labeledTextarea(
      content.answer,
      content.answerPlaceholder,
      answer.response,
      (value) => {
        answer.response = value;
        dirty = true;
      },
    );
    card.append(question, response);
    if (token)
      card.append(
        button(
          t.saveAnswer,
          "external-prep-text-button",
          () => void saveReusable(answer),
        ),
      );
    return card;
  }

  function stepEditor(step: Step): HTMLElement {
    const row = node("div", "external-prep-step");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = step.done;
    check.setAttribute("aria-label", step.text || t.checklist);
    check.addEventListener("change", () => {
      step.done = check.checked;
      dirty = true;
    });
    const text = document.createElement("input");
    text.type = "text";
    text.value = step.text;
    text.placeholder = t.stepPlaceholder;
    text.maxLength = 240;
    text.addEventListener("input", () => {
      step.text = text.value;
      dirty = true;
    });
    row.append(
      check,
      text,
      buttonWithIcon(Trash2, t.remove, "external-prep-icon-button", () => {
        preparation.checklist = preparation.checklist.filter(
          (candidate) => candidate.id !== step.id,
        );
        dirty = true;
        render();
      }),
    );
    return row;
  }

  function libraryPanel(): HTMLElement {
    const shade = node("div", "external-prep-drawer-shade");
    shade.addEventListener("click", (event) => {
      if (event.target === shade) {
        libraryOpen = false;
        render();
      }
    });
    const panel = node("section", "external-prep-drawer");
    const top = node("div", "external-prep-drawer-top");
    top.append(
      node("h2", "", t.reusable),
      button(t.back, "external-prep-text-button", () => {
        libraryOpen = false;
        render();
      }),
    );
    panel.append(top);
    if (!reusable.length)
      panel.append(
        node("p", "external-prep-help", token ? t.noReusable : t.saveFirst),
      );
    for (const saved of reusable) {
      const row = node("div", "external-prep-library-row");
      row.append(
        node("strong", "", saved.label),
        node("p", "", saved.response),
      );
      row.append(
        buttonWithIcon(Check, t.use, "external-prep-button", () => {
          const target = preparation.answers.find(
            (entry) => entry.id === libraryTargetId,
          );
          if (target) {
            target.question = saved.label;
            target.response = saved.response;
          } else {
            preparation.answers.push({
              id: uid(),
              question: saved.label,
              response: saved.response,
            });
          }
          libraryTargetId = null;
          libraryOpen = false;
          dirty = true;
          render();
        }),
      );
      panel.append(row);
    }
    shade.append(panel);
    return shade;
  }

  async function save(): Promise<void> {
    if (!token) return;
    const normalized = normalize();
    if (!normalized) {
      error =
        locale === "fr"
          ? "Ajoutez du texte à chaque question et étape."
          : "Add text to each question and step.";
      render();
      return;
    }
    pending = true;
    error = "";
    render();
    try {
      await request(
        `/external-preparations/${encodeURIComponent(recordId)}`,
        token,
        "PUT",
        normalized,
      );
      dirty = false;
      notice = t.saved;
    } catch (cause) {
      error = message(cause);
    }
    pending = false;
    render();
  }

  async function saveReusable(answer: Answer): Promise<void> {
    if (!token) return;
    if (!answer.question.trim() || !answer.response.trim()) return;
    const entry = {
      id: uid(),
      label: answer.question.trim(),
      response: answer.response.trim(),
    };
    try {
      await request(
        `/external-preparations/answers/${entry.id}`,
        token,
        "PUT",
        entry,
      );
      reusable.unshift(entry);
      notice = t.saved;
      render();
    } catch (cause) {
      error = message(cause);
      render();
    }
  }

  function normalize(): Preparation | null {
    if (
      preparation.answers.some((entry) => !entry.question.trim()) ||
      preparation.checklist.some((entry) => !entry.text.trim())
    )
      return null;
    return {
      status: "prepared-for-external",
      answers: preparation.answers.map((entry) => ({
        ...entry,
        question: entry.question.trim(),
        response: entry.response.trim(),
      })),
      checklist: preparation.checklist.map((entry) => ({
        ...entry,
        text: entry.text.trim(),
      })),
    };
  }

  function download(): void {
    if (!record) return;
    const content = wording();
    const title = record.title;
    const lines = [
      title,
      `${t.source}: ${record.publisher}`,
      `${t.open}: ${record.officialUrl}`,
      "",
      content.questions,
    ];
    for (const answer of preparation.answers)
      lines.push(answer.question, answer.response, "");
    lines.push(t.checklist);
    for (const step of preparation.checklist)
      lines.push(`${step.done ? "[x]" : "[ ]"} ${step.text}`);
    lines.push("", content.officialHint);
    const blob = new Blob([`${lines.join("\n")}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `envoy-preparation-${recordId}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  void load();
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
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function icon(svg: string): HTMLElement {
  const span = node("span", "external-prep-icon");
  span.innerHTML = svg;
  return span;
}
function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const element = node("button", className, label);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}
function buttonWithIcon(
  svg: string,
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const element = button(label, className, onClick);
  element.prepend(icon(svg));
  return element;
}
function labeledInput(
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
): HTMLElement {
  const wrapper = node("label", "external-prep-field");
  wrapper.append(node("span", "", label));
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 240;
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}
function labeledTextarea(
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
): HTMLElement {
  const wrapper = node("label", "external-prep-field");
  wrapper.append(node("span", "", label));
  const input = document.createElement("textarea");
  input.rows = 5;
  input.maxLength = 4000;
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}
function uid(): string {
  return `a${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
