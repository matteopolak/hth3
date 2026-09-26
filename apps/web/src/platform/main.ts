import {
  type ApplicationStatus,
  type FeedbackStatus,
  type Locale,
} from "@civicresolve/contracts/v1";
import { tokens } from "@civicresolve/design-tokens";
import { translate, type MessageKey } from "@civicresolve/i18n";
import {
  api,
  type ApplicationView,
  type FeedbackClientReceipt,
  type ReceiptCredentials,
  type StaffFeedbackView,
  WorkerApiError,
} from "./api.js";
import "./styles.css";

type Page = "feedback" | "applications" | "employee";
type EmployeePage = "feedback" | "applications";

interface AppState {
  locale: Locale;
  page: Page;
  employeePage: EmployeePage;
  localIdentity: string;
  postings: Array<{
    id: string;
    organizationName: string;
    title: string;
    description: string;
    sample: true;
  }>;
  postingsLoading: boolean;
  postingsError: string;
  selectedPostingId: string;
  applicantApplications: ApplicationView[];
  applicationListLoadedFor: string;
  applicationListLoading: boolean;
  feedbackQueue: StaffFeedbackView[];
  feedbackQueueLoadedFor: string;
  applicationQueue: ApplicationView[];
  applicationQueueLoadedFor: string;
  employeeLoading: boolean;
  receiptCredentials: ReceiptCredentials | null;
  receipt: FeedbackClientReceipt | null;
  receiptError: string;
  feedbackDraft: string;
  feedbackImprovement: string;
  feedbackReviewing: boolean;
  sandboxAcknowledged: boolean;
  applicationExperience: string;
  applicationAvailability: string;
  applicationConfirmed: boolean;
  pending: string;
  error: { message: string; requestId: string } | null;
  notice: string;
}

const RECEIPT_KEY = "civicresolve.private-receipt.v1";
const LOCAL_IDENTITIES = [
  ["", "local.identityNone"],
  ["dev-applicant", "local.applicant"],
  ["dev-civic-staff", "local.civicReviewer"],
  ["dev-hiring-reviewer", "local.hiringReviewer"],
  ["dev-organization-admin", "local.admin"],
] as const;

const state: AppState = {
  locale: readLocale(),
  page: "feedback",
  employeePage: "feedback",
  localIdentity: "",
  postings: [],
  postingsLoading: true,
  postingsError: "",
  selectedPostingId: "",
  applicantApplications: [],
  applicationListLoadedFor: "",
  applicationListLoading: false,
  feedbackQueue: [],
  feedbackQueueLoadedFor: "",
  applicationQueue: [],
  applicationQueueLoadedFor: "",
  employeeLoading: false,
  receiptCredentials: readReceiptCredentials(),
  receipt: null,
  receiptError: "",
  feedbackDraft: "",
  feedbackImprovement: "",
  feedbackReviewing: false,
  sandboxAcknowledged: false,
  applicationExperience: "",
  applicationAvailability: "",
  applicationConfirmed: false,
  pending: "",
  error: null,
  notice: "",
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root is missing.");

applyTokens();
render();
void loadPostings();
if (state.receiptCredentials) void refreshReceipt();

function render(): void {
  document.documentElement.lang = state.locale;
  root!.replaceChildren();
  root!.append(header(), navigation());
  const identity = devIdentityPanel();
  if (identity) root!.append(identity);
  root!.append(mainPage());
}

function header(): HTMLElement {
  const header = el("header", "masthead");
  const inner = el("div", "masthead-inner");
  const brand = el("a", "brand");
  brand.href = "/";
  brand.setAttribute("aria-label", t("app.name"));
  brand.append(el("span", "brand-mark", "C"), el("span", "brand-name", t("app.name")));

  const context = el("div", "header-context");
  context.append(
    el("span", "context-dot", ""),
    el("span", "context-label", t("feedback.sandboxBadge")),
  );
  const locale = el("label", "locale-control");
  locale.append(el("span", "sr-only", t("app.language")));
  const select = el("select", "locale-select") as HTMLSelectElement;
  select.setAttribute("aria-label", t("app.language"));
  select.append(
    option("en", "English", state.locale),
    option("fr", "Français", state.locale),
  );
  select.addEventListener("change", () => {
    state.locale = select.value as Locale;
    localStorage.setItem("civicresolve.locale", state.locale);
    render();
  });
  locale.append(select);
  inner.append(brand, context, locale);
  header.append(inner);
  return header;
}

function navigation(): HTMLElement {
  const nav = el("nav", "primary-nav");
  nav.setAttribute("aria-label", t("app.name"));
  nav.append(
    navButton("feedback", "nav.feedback", "feedback"),
    navButton("applications", "nav.applications", "briefcase"),
    navButton("employee", "nav.employee", "building"),
  );
  return nav;
}

function navButton(page: Page, key: MessageKey, icon: string): HTMLButtonElement {
  const button = el("button", `nav-item ${state.page === page ? "is-active" : ""}`) as HTMLButtonElement;
  button.type = "button";
  button.setAttribute("aria-current", state.page === page ? "page" : "false");
  button.append(iconNode(icon), el("span", "", t(key)));
  button.addEventListener("click", () => {
    state.page = page;
    state.error = null;
    state.notice = "";
    render();
    if (page === "applications") void loadMyApplications();
  });
  return button;
}

function devIdentityPanel(): HTMLElement | null {
  if (!import.meta.env.DEV) return null;
  const panel = el("section", "local-identity");
  const copy = el("div", "local-identity-copy");
  copy.append(
    el("strong", "", t("local.identityLabel")),
    el("p", "", t("local.identityNotice")),
  );
  const select = el("select", "identity-select") as HTMLSelectElement;
  select.setAttribute("aria-label", t("local.identityLabel"));
  for (const [value, key] of LOCAL_IDENTITIES) {
    select.append(option(value, t(key), state.localIdentity));
  }
  select.addEventListener("change", () => {
    state.localIdentity = select.value;
    state.applicationListLoadedFor = "";
    state.feedbackQueueLoadedFor = "";
    state.applicationQueueLoadedFor = "";
    render();
    if (state.page === "applications") void loadMyApplications();
  });
  panel.append(copy, select);
  return panel;
}

function mainPage(): HTMLElement {
  const main = el("main", "page-wrap");
  const intro = el("div", "page-intro");
  intro.append(
    el("p", "eyebrow", state.page === "employee" ? t("nav.employee") : t("app.name")),
    el("h1", "", pageTitle()),
    el("p", "lead", pageDescription()),
  );
  main.append(intro);
  if (state.error) main.append(alertBox(state.error.message, state.error.requestId));
  if (state.notice) main.append(alertBox(state.notice, "", "notice"));

  if (state.page === "feedback") main.append(feedbackPage());
  else if (state.page === "applications") main.append(applicationsPage());
  else main.append(employeePage());
  return main;
}

function feedbackPage(): HTMLElement {
  const layout = el("div", "two-column");
  const left = el("section", "surface primary-surface");
  if (state.feedbackReviewing) left.append(feedbackReview());
  else left.append(feedbackForm());
  if (state.receipt) left.append(receiptPanel());
  else left.append(el("p", "quiet-note", t("feedback.noReceipt")));

  const aside = el("aside", "surface context-surface");
  aside.append(
    el("span", "eyebrow", t("feedback.sandboxBadge")),
    el("h2", "aside-title", t("feedback.sandboxExplanation")),
    el("p", "", t("feedback.privacyNotice")),
    el("p", "emergency-note", t("feedback.emergencyNote")),
  );
  layout.append(left, aside);
  return layout;
}

function feedbackForm(): HTMLElement {
  const form = el("form", "form-stack");
  const message = textArea(
    "feedback-message",
    t("feedback.messageLabel"),
    t("feedback.messagePlaceholder"),
    state.feedbackDraft,
    (value) => (state.feedbackDraft = value),
  );
  const improvement = textArea(
    "feedback-improvement",
    t("feedback.improvementLabel"),
    t("feedback.improvementPlaceholder"),
    state.feedbackImprovement,
    (value) => (state.feedbackImprovement = value),
    3,
  );
  form.append(message, improvement);
  const actions = el("div", "form-actions");
  const review = button(t("feedback.review"), "button-primary", () => {
    if (!state.feedbackDraft.trim()) {
      state.error = { message: t("error.invalidRequest"), requestId: "" };
      render();
      return;
    }
    state.feedbackReviewing = true;
    state.error = null;
    render();
  });
  review.disabled = state.pending === "feedback";
  actions.append(review);
  form.append(actions);
  form.addEventListener("submit", (event) => event.preventDefault());
  return form;
}

function feedbackReview(): HTMLElement {
  const review = el("div", "review-sheet");
  review.append(
    el("h3", "review-title", t("feedback.reviewTitle")),
    labeledValue(t("feedback.originalMessage"), state.feedbackDraft),
  );
  if (state.feedbackImprovement.trim()) {
    review.append(labeledValue(t("feedback.improvementLabel"), state.feedbackImprovement));
  }
  const acknowledgment = el("label", "checkbox-row");
  const checkbox = el("input") as HTMLInputElement;
  checkbox.type = "checkbox";
  checkbox.checked = state.sandboxAcknowledged;
  checkbox.addEventListener("change", () => {
    state.sandboxAcknowledged = checkbox.checked;
    const send = review.querySelector<HTMLButtonElement>("[data-send-feedback]");
    if (send) send.disabled = !checkbox.checked || state.pending === "feedback";
  });
  acknowledgment.append(checkbox, el("span", "", t("feedback.sandboxAcknowledgement")));
  review.append(acknowledgment);
  const actions = el("div", "form-actions split-actions");
  actions.append(
    button(t("feedback.edit"), "button-quiet", () => {
      state.feedbackReviewing = false;
      state.error = null;
      render();
    }),
  );
  const send = button(t("feedback.sendToSample"), "button-primary", () => void submitFeedback());
  send.dataset.sendFeedback = "true";
  send.disabled = !state.sandboxAcknowledged || state.pending === "feedback";
  if (state.pending === "feedback") send.prepend(spinner());
  actions.append(send);
  review.append(actions);
  return review;
}

function receiptPanel(): HTMLElement {
  const receipt = state.receipt!;
  const panel = el("section", "receipt-panel");
  const titleRow = el("div", "receipt-head");
  titleRow.append(
    el("div", "", el("span", "eyebrow", t("feedback.receiptTitle")), el("h3", "receipt-id", receipt.id)),
    statusPill(receipt.status),
  );
  panel.append(titleRow, el("p", "privacy-line", t("feedback.receiptSecretHelp")));
  if (state.receiptError) {
    panel.append(alertBox(state.receiptError, ""));
    panel.append(button(t("common.refresh"), "button-quiet", () => void refreshReceipt()));
  }
  const thread = el("div", "message-thread");
  for (const message of receipt.messages) {
    const item = el("article", `message-item ${message.author === "resident" ? "from-resident" : "from-staff"}`);
    item.append(
      el("div", "message-meta", message.author === "staff" ? t("feedback.staffReply") : t("feedback.originalMessage")),
      el("p", "message-body", message.body),
    );
    thread.append(item);
  }
  panel.append(thread);
  if (state.receiptCredentials && receipt.status !== "closed") {
    const reply = el("form", "reply-form");
    const input = textArea(
      "resident-follow-up",
      t("feedback.reply"),
      t("feedback.replyPlaceholder"),
      "",
      () => {},
      2,
    );
    const send = button(t("feedback.replySend"), "button-secondary", () => void submitResidentFollowUp(input.querySelector("textarea")?.value ?? ""));
    send.disabled = state.pending === "resident-reply";
    reply.append(input, send);
    reply.addEventListener("submit", (event) => event.preventDefault());
    panel.append(reply);
  }
  return panel;
}

function applicationsPage(): HTMLElement {
  const layout = el("div", "two-column");
  const main = el("section", "surface primary-surface");
  main.append(sectionHeading(t("application.title"), t("application.signInStep")));
  if (state.postingsLoading) {
    main.append(loadingState());
  } else if (state.postingsError) {
    main.append(alertBox(state.postingsError, ""));
    main.append(button(t("common.retry"), "button-quiet", () => void loadPostings()));
  } else if (state.postings.length === 0) {
    main.append(emptyState(t("application.loadError")));
  } else {
    const posting = state.postings.find((item) => item.id === state.selectedPostingId) ?? state.postings[0]!;
    const summary = el("article", "posting-summary");
    summary.append(
      el("span", "sample-tag", t("feedback.sandboxBadge")),
      el("h2", "posting-title", posting.title),
      el("p", "posting-org", posting.organizationName),
      el("p", "", posting.description),
      el("span", "quiet-note", t("application.sampleGeography")),
    );
    main.append(summary, applicationForm(posting.id));
  }

  const aside = el("aside", "surface context-surface");
  aside.append(
    el("span", "eyebrow", t("application.status")),
    el("h2", "aside-title", t("application.inQueue")),
  );
  if (!currentToken()) {
    aside.append(el("p", "", t("auth.signInRequired")));
  } else if (state.applicationListLoading) {
    aside.append(loadingState());
  } else if (state.applicationListLoadedFor !== currentToken()) {
    aside.append(button(t("common.refresh"), "button-secondary", () => void loadMyApplications()));
  } else if (state.applicantApplications.length === 0) {
    aside.append(el("p", "", t("application.noApplications")));
  } else {
    for (const application of state.applicantApplications) {
      const row = el("div", "activity-row");
      row.append(
        el("strong", "", application.postingTitle ?? application.postingId),
        statusPill(application.status),
        el("span", "quiet-note", formatDate(application.updatedAt)),
      );
      aside.append(row);
    }
  }
  layout.append(main, aside);
  return layout;
}

function applicationForm(postingId: string): HTMLElement {
  const form = el("form", "form-stack application-form");
  form.append(
    textArea(
      "application-experience",
      t("application.experienceLabel"),
      t("application.experiencePlaceholder"),
      state.applicationExperience,
      (value) => (state.applicationExperience = value),
      4,
    ),
    textArea(
      "application-availability",
      t("application.availabilityLabel"),
      t("application.availabilityPlaceholder"),
      state.applicationAvailability,
      (value) => (state.applicationAvailability = value),
      2,
    ),
  );
  const confirm = el("label", "checkbox-row");
  const checkbox = el("input") as HTMLInputElement;
  checkbox.type = "checkbox";
  checkbox.checked = state.applicationConfirmed;
  checkbox.addEventListener("change", () => {
    state.applicationConfirmed = checkbox.checked;
    const submit = form.querySelector<HTMLButtonElement>("[data-submit-application]");
    if (submit) submit.disabled = !checkbox.checked || state.pending === "application";
  });
  confirm.append(checkbox, el("span", "", t("application.applicantConfirmation")));
  form.append(confirm);
  const actions = el("div", "form-actions");
  const submit = button(t("application.apply"), "button-primary", () => void submitApplication(postingId));
  submit.dataset.submitApplication = "true";
  submit.disabled = !state.applicationConfirmed || state.pending === "application";
  if (state.pending === "application") submit.prepend(spinner());
  actions.append(submit);
  form.append(actions);
  form.addEventListener("submit", (event) => event.preventDefault());
  return form;
}

function employeePage(): HTMLElement {
  const layout = el("div", "employee-layout");
  const side = el("aside", "surface employee-menu");
  side.append(
    el("span", "eyebrow", t("nav.employee")),
    employeeNavButton("feedback", "nav.feedbackQueue"),
    employeeNavButton("applications", "nav.applicationQueue"),
    el("p", "quiet-note", t("staff.permissionNotice")),
  );
  const main = el("section", "surface employee-content");
  if (state.employeePage === "feedback") {
    main.append(sectionHeading(t("nav.feedbackQueue"), t("feedback.sandboxBadge")));
    if (!currentToken()) main.append(signInPrompt());
    else if (state.employeeLoading) main.append(loadingState());
    else if (state.feedbackQueueLoadedFor !== currentToken()) {
      main.append(button(t("common.refresh"), "button-secondary", () => void loadEmployeeQueue()));
    } else if (state.feedbackQueue.length === 0) {
      main.append(emptyState(t("feedback.noFeedback")));
    } else {
      main.append(feedbackQueueList());
    }
  } else {
    main.append(sectionHeading(t("nav.applicationQueue"), t("application.sampleNotice")));
    if (!currentToken()) main.append(signInPrompt());
    else if (state.employeeLoading) main.append(loadingState());
    else if (state.applicationQueueLoadedFor !== currentToken()) {
      main.append(button(t("common.refresh"), "button-secondary", () => void loadEmployeeQueue()));
    } else if (state.applicationQueue.length === 0) {
      main.append(emptyState(t("application.noQueue")));
    } else {
      main.append(applicationQueueList());
    }
  }
  layout.append(side, main);
  return layout;
}

function employeeNavButton(page: EmployeePage, key: MessageKey): HTMLButtonElement {
  const button = el("button", `employee-nav ${state.employeePage === page ? "is-selected" : ""}`) as HTMLButtonElement;
  button.type = "button";
  button.textContent = t(key);
  button.addEventListener("click", () => {
    state.employeePage = page;
    state.error = null;
    render();
    if (currentToken()) void loadEmployeeQueue();
  });
  return button;
}

function feedbackQueueList(): HTMLElement {
  const wrapper = el("div", "queue-list");
  const refresh = button(t("common.refresh"), "button-quiet", () => void loadEmployeeQueue());
  wrapper.append(refresh);
  for (const item of state.feedbackQueue) {
    const row = el("article", "queue-entry");
    row.append(
      el("div", "queue-entry-head", el("strong", "", formatDate(item.createdAt)), statusPill(item.status)),
      el("p", "queue-text", item.originalText),
      el("span", "sample-tag", t("feedback.sandboxBadge")),
    );
    const reply = textArea(`staff-feedback-${item.id}`, t("feedback.reply"), t("feedback.replyPlaceholder"), "", () => {}, 2);
    const actions = el("div", "form-actions staff-actions");
    const respond = button(t("feedback.replySend"), "button-secondary", () => {
      void withPending(`reply-${item.id}`, async () => {
        await api.replyToFeedback(currentToken()!, "org_43G1B1RhPwac7EjS", item.id, reply.querySelector("textarea")?.value ?? "");
        await loadEmployeeQueue();
      });
    });
    const next = selectStatuses(
      nextFeedbackStatuses(item.status),
      item.status,
      "feedback.nextStatus",
    );
    const outcome = textArea(
      `staff-outcome-${item.id}`,
      t("feedback.outcomeLabel"),
      t("feedback.outcomeLabel"),
      "",
      () => {},
      2,
    );
    const update = button(t("feedback.updateStatus"), "button-quiet", () => {
      if (next.value === "outcome_recorded" && !outcome.querySelector("textarea")?.value.trim()) {
        state.error = { message: t("feedback.outcomeRequired"), requestId: "" };
        render();
        return;
      }
      void withPending(`feedback-status-${item.id}`, async () => {
        await api.changeFeedbackStatus(
          currentToken()!,
          "org_43G1B1RhPwac7EjS",
          item.id,
          next.value as FeedbackStatus,
          outcome.querySelector("textarea")?.value,
        );
        await loadEmployeeQueue();
      });
    });
    respond.disabled = state.pending === `reply-${item.id}`;
    update.disabled = state.pending === `feedback-status-${item.id}`;
    actions.append(respond, next, update);
    row.append(reply, outcome, actions);
    wrapper.append(row);
  }
  return wrapper;
}

function applicationQueueList(): HTMLElement {
  const wrapper = el("div", "queue-list");
  wrapper.append(button(t("common.refresh"), "button-quiet", () => void loadEmployeeQueue()));
  for (const item of state.applicationQueue) {
    const row = el("article", "queue-entry application-entry");
    row.append(
      el("div", "queue-entry-head", el("strong", "", item.postingTitle ?? item.postingId), statusPill(item.status)),
      el("span", "quiet-note", `${t("application.answers")}: ${item.applicantSubject ?? ""}`),
      el("span", "sample-tag", t("feedback.sandboxBadge")),
      el("h4", "answer-title", t("application.answers")),
    );
    for (const [question, answer] of Object.entries(item.answers)) {
      row.append(labeledValue(question, answer));
    }
    const next = selectStatuses(
      nextApplicationStatuses(item.status),
      item.status,
      "application.changeStatus",
    );
    const update = button(t("application.saveStatus"), "button-secondary", () => {
      void withPending(`application-status-${item.id}`, async () => {
        await api.changeApplicationStatus(currentToken()!, "org_43G1B1RhPwac7EjS", item.id, next.value as ApplicationStatus);
        await loadEmployeeQueue();
      });
    });
    update.disabled = state.pending === `application-status-${item.id}`;
    row.append(el("div", "form-actions staff-actions", next, update));
    wrapper.append(row);
  }
  return wrapper;
}

function signInPrompt(): HTMLElement {
  const prompt = el("div", "sign-in-prompt");
  prompt.append(
    el("h3", "", t("auth.signInRequired")),
    el("p", "", t("local.identityNotice")),
  );
  return prompt;
}

function sectionHeading(title: string, description: string): HTMLElement {
  return el("div", "section-heading", el("h2", "", title), el("p", "", description));
}

function labeledValue(label: string, value: string): HTMLElement {
  return el("div", "labeled-value", el("span", "field-caption", label), el("p", "", value));
}

function textArea(
  id: string,
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
  rows = 5,
): HTMLElement {
  const wrapper = el("label", "field");
  wrapper.htmlFor = id;
  wrapper.append(el("span", "field-caption", label));
  const area = el("textarea", "textarea") as HTMLTextAreaElement;
  area.id = id;
  area.name = id;
  area.rows = rows;
  area.placeholder = placeholder;
  area.value = value;
  area.addEventListener("input", () => onInput(area.value));
  wrapper.append(area);
  return wrapper;
}

function selectStatuses(
  values: readonly string[],
  selected: string,
  labelKey: MessageKey,
): HTMLSelectElement {
  const select = el("select", "status-select") as HTMLSelectElement;
  select.setAttribute("aria-label", t(labelKey));
  if (values.length === 0) {
    select.append(option(selected, statusName(selected), selected));
    select.disabled = true;
  } else {
    for (const status of values) select.append(option(status, statusName(status), selected));
  }
  return select;
}

function statusPill(status: string): HTMLElement {
  return el("span", `status-pill status-${status}`, statusName(status));
}

function option(value: string, label: string, selected: string): HTMLOptionElement {
  const result = el("option") as HTMLOptionElement;
  result.value = value;
  result.textContent = label;
  result.selected = value === selected;
  return result;
}

function button(
  label: string,
  className: string,
  action: () => void,
): HTMLButtonElement {
  const result = el("button", className, label) as HTMLButtonElement;
  result.type = "button";
  result.addEventListener("click", action);
  return result;
}

function loadingState(): HTMLElement {
  return el("div", "loading-state", spinner(), el("span", "", t("common.loading")));
}

function spinner(): HTMLElement {
  const result = el("span", "spinner");
  result.setAttribute("aria-hidden", "true");
  return result;
}

function emptyState(message: string): HTMLElement {
  return el("div", "empty-state", el("span", "empty-mark", "—"), el("p", "", message));
}

function alertBox(message: string, requestId: string, kind = "error"): HTMLElement {
  const alert = el("div", `inline-alert ${kind}`);
  alert.setAttribute("role", kind === "error" ? "alert" : "status");
  alert.append(el("p", "", message));
  if (requestId) alert.append(el("small", "request-id", `Request ${requestId}`));
  return alert;
}

function iconNode(kind: string): HTMLElement {
  const icons: Record<string, string> = {
    feedback: "✳",
    briefcase: "▱",
    building: "⌂",
  };
  return el("span", "nav-icon", icons[kind] ?? "·");
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

function pageTitle(): string {
  if (state.page === "feedback") return t("feedback.title");
  if (state.page === "applications") return t("application.title");
  return t("nav.employee");
}

function pageDescription(): string {
  if (state.page === "feedback") return t("feedback.intro");
  if (state.page === "applications") return t("application.signInStep");
  return t("feedback.sandboxBadge");
}

function currentToken(): string {
  return state.localIdentity;
}

function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  return translate(state.locale, key, values);
}

function statusName(status: string): string {
  const keys: Record<string, MessageKey> = {
    submitted: "status.submitted",
    acknowledged: "status.acknowledged",
    in_review: "status.inReview",
    waiting_on_resident: "status.waiting",
    outcome_recorded: "status.outcome",
    closed: "status.closed",
    reopened: "status.reopened",
    under_review: "status.underReview",
    information_requested: "status.informationRequested",
    shortlisted: "status.shortlisted",
    declined: "status.declined",
    offer: "status.offer",
  };
  return keys[status] ? t(keys[status]!) : status;
}

function nextFeedbackStatuses(status: string): readonly string[] {
  const transitions: Record<string, readonly string[]> = {
    submitted: ["acknowledged"],
    acknowledged: ["in_review"],
    in_review: ["waiting_on_resident", "outcome_recorded"],
    waiting_on_resident: ["in_review"],
    outcome_recorded: ["closed", "reopened"],
    closed: ["reopened"],
    reopened: ["in_review"],
  };
  return transitions[status] ?? [];
}

function nextApplicationStatuses(status: string): readonly string[] {
  const transitions: Record<string, readonly string[]> = {
    submitted: ["under_review"],
    under_review: ["information_requested", "shortlisted", "declined"],
    information_requested: ["under_review", "declined"],
    shortlisted: ["offer", "declined"],
    declined: [],
    offer: [],
  };
  return transitions[status] ?? [];
}

function formatError(error: unknown): { message: string; requestId: string } {
  if (!(error instanceof WorkerApiError)) {
    return { message: t("error.generic"), requestId: "" };
  }
  const keyByCode: Record<string, MessageKey> = {
    NETWORK_ERROR: "error.network",
    INVALID_REQUEST: "error.invalidRequest",
    UNAUTHENTICATED: "error.unauthenticated",
    FORBIDDEN: "error.forbidden",
    NOT_FOUND: "error.notFound",
    INVALID_STATE_TRANSITION: "error.invalidTransition",
    FEEDBACK_CLOSED: "error.feedbackClosed",
    DESTINATION_NOT_SUPPORTED: "error.destinationUnsupported",
    EMERGENCY_REDIRECT: "error.emergency",
    INTERNAL_ERROR: "error.generic",
    SANDBOX_UNAVAILABLE: "error.generic",
  };
  const key = keyByCode[error.code] ?? "error.generic";
  return { message: t(key), requestId: error.requestId };
}

async function loadPostings(): Promise<void> {
  state.postingsLoading = true;
  state.postingsError = "";
  if (state.page === "applications") render();
  try {
    const response = await api.getPostings();
    state.postings = response.postings;
    if (!state.postings.some((posting) => posting.id === state.selectedPostingId)) {
      state.selectedPostingId = state.postings[0]?.id ?? "";
    }
  } catch (error) {
    state.postingsError = formatError(error).message;
  } finally {
    state.postingsLoading = false;
    if (state.page === "applications") render();
  }
}

async function submitFeedback(): Promise<void> {
  if (!state.sandboxAcknowledged || !state.feedbackDraft.trim()) return;
  state.pending = "feedback";
  state.error = null;
  render();
  try {
    const credentials: ReceiptCredentials = {
      submissionId: "pending",
      receiptToken: randomReceiptToken(),
    };
    const response = await api.submitFeedback(
      state.feedbackDraft,
      state.feedbackImprovement,
      credentials,
      state.locale,
    );
    state.receiptCredentials = {
      submissionId: response.submission.id,
      receiptToken: response.receiptToken,
    };
    state.receipt = response.submission;
    storeReceiptCredentials(state.receiptCredentials);
    state.feedbackReviewing = false;
    state.feedbackDraft = "";
    state.feedbackImprovement = "";
    state.sandboxAcknowledged = false;
    state.notice = t("feedback.submitted", { receiptId: response.submission.id });
    await refreshReceipt(false);
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.pending = "";
    render();
  }
}

async function refreshReceipt(showPending = true): Promise<void> {
  if (!state.receiptCredentials) return;
  if (showPending) state.pending = "receipt";
  state.receiptError = "";
  try {
    const response = await api.getReceipt(state.receiptCredentials);
    state.receipt = response.submission;
  } catch (error) {
    state.receiptError = formatError(error).message;
  } finally {
    if (showPending) state.pending = "";
    if (state.page === "feedback") render();
  }
}

async function submitResidentFollowUp(message: string): Promise<void> {
  if (!state.receiptCredentials || !message.trim()) return;
  state.pending = "resident-reply";
  state.error = null;
  render();
  try {
    await api.addResidentMessage(state.receiptCredentials, message);
    await refreshReceipt(false);
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.pending = "";
    render();
  }
}

async function loadMyApplications(): Promise<void> {
  const token = currentToken();
  if (!token) {
    state.applicantApplications = [];
    state.applicationListLoadedFor = "";
    render();
    return;
  }
  state.applicationListLoading = true;
  state.error = null;
  render();
  try {
    const response = await api.getApplications(token);
    state.applicantApplications = response.applications;
    state.applicationListLoadedFor = token;
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.applicationListLoading = false;
    render();
  }
}

async function submitApplication(postingId: string): Promise<void> {
  if (!state.applicationConfirmed) return;
  const token = currentToken();
  if (!token) {
    state.error = { message: t("error.unauthenticated"), requestId: "" };
    render();
    return;
  }
  if (!state.applicationExperience.trim() || !state.applicationAvailability.trim()) {
    state.error = { message: t("error.invalidRequest"), requestId: "" };
    render();
    return;
  }
  state.pending = "application";
  state.error = null;
  render();
  try {
    const response = await api.submitApplication(token, {
      postingId,
      answers: {
        experience: state.applicationExperience,
        availability: state.applicationAvailability,
      },
      confirmedByApplicant: true,
    });
    state.notice = t("application.submitted", {
      organization: state.postings.find((posting) => posting.id === postingId)?.organizationName ?? t("feedback.sandboxBadge"),
    });
    state.applicationListLoadedFor = "";
    state.applicationConfirmed = false;
    await loadMyApplications();
    if (!state.applicantApplications.some((application) => application.id === response.application.id)) {
      state.applicantApplications.unshift(response.application);
    }
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.pending = "";
    render();
  }
}

async function loadEmployeeQueue(): Promise<void> {
  const token = currentToken();
  if (!token) {
    state.error = { message: t("error.unauthenticated"), requestId: "" };
    render();
    return;
  }
  state.employeeLoading = true;
  state.error = null;
  render();
  try {
    if (state.employeePage === "feedback") {
      const response = await api.getStaffFeedback(token, "org_43G1B1RhPwac7EjS");
      state.feedbackQueue = response.submissions;
      state.feedbackQueueLoadedFor = token;
    } else {
      const response = await api.getStaffApplications(token, "org_43G1B1RhPwac7EjS");
      state.applicationQueue = response.applications;
      state.applicationQueueLoadedFor = token;
    }
  } catch (error) {
    state.error = formatError(error);
    if (state.employeePage === "feedback") state.feedbackQueueLoadedFor = "";
    else state.applicationQueueLoadedFor = "";
  } finally {
    state.employeeLoading = false;
    render();
  }
}

async function withPending(key: string, operation: () => Promise<void>): Promise<void> {
  state.pending = key;
  state.error = null;
  render();
  try {
    await operation();
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.pending = "";
    render();
  }
}

function randomReceiptToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function storeReceiptCredentials(credentials: ReceiptCredentials): void {
  try {
    sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(credentials));
  } catch {
    state.receiptError = t("error.generic");
  }
}

function readReceiptCredentials(): ReceiptCredentials | null {
  try {
    const value = sessionStorage.getItem(RECEIPT_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<ReceiptCredentials>;
    if (
      typeof parsed.submissionId !== "string" ||
      typeof parsed.receiptToken !== "string" ||
      !/^fb_[a-f0-9]{32}$/i.test(parsed.submissionId) ||
      !/^[a-f0-9]{64}$/i.test(parsed.receiptToken)
    )
      return null;
    return {
      submissionId: parsed.submissionId,
      receiptToken: parsed.receiptToken,
    };
  } catch {
    return null;
  }
}

function readLocale(): Locale {
  const saved = localStorage.getItem("civicresolve.locale");
  return saved === "fr" ? "fr" : "en";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(state.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function applyTokens(): void {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--color-text", tokens.color.text);
  rootStyle.setProperty("--color-muted", tokens.color.textMuted);
  rootStyle.setProperty("--color-surface", tokens.color.surface);
  rootStyle.setProperty("--color-canvas", tokens.color.canvas);
  rootStyle.setProperty("--color-border", tokens.color.border);
  rootStyle.setProperty("--color-accent", tokens.color.accent);
  rootStyle.setProperty("--color-accent-strong", tokens.color.accentStrong);
  rootStyle.setProperty("--color-success", tokens.color.success);
  rootStyle.setProperty("--color-warning", tokens.color.warning);
  rootStyle.setProperty("--color-danger", tokens.color.danger);
  rootStyle.setProperty("--color-focus", tokens.color.focus);
  rootStyle.setProperty("--font-body", tokens.typography.body);
}
