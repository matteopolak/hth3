import {
  type ApplicationStatus,
  type FeedbackStatus,
  type Locale,
  type StaffWorkspaceSummary,
} from "@civicresolve/contracts/v1";
import { tokens } from "@civicresolve/design-tokens";
import { translate, type MessageKey } from "@civicresolve/i18n";
import { uiButton, uiCard, uiField, uiStatus, type ButtonVariant } from "@civicresolve/ui";
import { createDiscoveryPage, type DiscoveryArea } from "../features/discovery/index.js";
import { createProfilePage } from "../features/profile/index.js";
import { createProgramIntakePage } from "../features/program-intake/index.js";
import { createParticipationPage } from "../features/participation/index.js";
import { createPublicApplicationsPage } from "../features/applications/index.js";
import { createPublicProgramsPage } from "../features/programs/index.js";
import { createExternalPreparationPage } from "../features/external-preparation/index.js";
import { createResidentFeedbackCase } from "../features/feedback/resident-case.js";
import { reopenResidentFeedback } from "../features/feedback/api.js";
import { agentApprovalIntro, agentApprovalState, agentResult } from "../features/agent-results/index.js";
import { loadStaffWorkspaceSummary, staffFeedbackOperations, staffWorkspace, viewAllowed } from "../features/staff/index.js";
import { webAuth } from "./auth0.js";
import {
  Activity, ArrowUp, Blocks, BriefcaseBusiness, ChartNoAxesColumn,
  ChevronDown, ChevronRight, FileText, Inbox, ListTree, LogIn, LogOut,
  MapPin, Menu, MessageSquare, Mic, PanelLeftClose, Plus, Search,
  Tags, UserRound, Users, Building2, BookOpen, Bookmark, ClipboardList,
  Coins, HeartHandshake, Landmark, MessagesSquare, LayoutDashboard, Check,
} from "lucide-static";
import {
  api,
  type AgentProposal,
  type AgentTool,
  type ApplicationView,
  type FeedbackClientReceipt,
  type ReceiptCredentials,
  type StaffFeedbackView,
  WorkerApiError,
} from "./api.js";
import "@civicresolve/ui/styles.css";
import "./styles.css";
import "../features/feedback/feedback.css";

type Page = "assistant" | "feedback" | "applications" | "employee" | "discovery" | "profile" | "signin" | "programs" | "external-preparation";
type EmployeePage = "assistant" | "feedback" | "applications";
type StaffView = "issues" | "overview" | "themes" | "taxonomy" | "hiring" | "applicants" | "analytics" | "audit";
type ChatMode = "resident" | "employee";

interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  result?: unknown;
}

interface ChatHistoryEntry {
  id: string;
  label: string;
  updatedAt: string;
  token?: string;
}

interface ChatState {
  id: string;
  token: string;
  messages: ChatMessage[];
  proposals: AgentProposal[];
  draft: string;
  pending: boolean;
  error: string;
  approvalChecked: Record<string, boolean>;
  duplicateOverrideChecked: Record<string, boolean>;
  reportEdits: Record<string, string>;
  tools: AgentTool[];
  tray: "actions" | "area" | "files" | "plugins" | null;
  toolSearch: string;
  history: ChatHistoryEntry[];
  historyLoaded: boolean;
  contextArea: string | null;
  savedResume: string | null;
  modelOpen: boolean;
  thinkingOpen: boolean;
  modelChoice: "fast" | "balanced";
}

function newChatState(): ChatState {
  return {
    id: "",
    token: "",
    messages: [],
    proposals: [],
    draft: "",
    pending: false,
    error: "",
    approvalChecked: {},
    duplicateOverrideChecked: {},
    reportEdits: {},
    tools: [],
    tray: null,
    toolSearch: "",
    history: [],
    historyLoaded: false,
    contextArea: null,
    savedResume: null,
    modelOpen: false,
    thinkingOpen: false,
    modelChoice: "balanced",
  };
}

interface AppState {
  locale: Locale;
  page: Page;
  applicationView: "browse" | "mine";
  discoveryArea: DiscoveryArea;
  programView: "discover" | "mine" | "sponsor";
  externalRecordId: string;
  employeePage: EmployeePage;
  staffView: StaffView;
  localIdentity: string;
  postings: Array<{
    id: string;
    organizationName: string;
    title: string;
    description: string;
    sample: boolean;
  }>;
  postingsLoading: boolean;
  postingsError: string;
  selectedPostingId: string;
  applicantApplications: ApplicationView[];
  applicationListLoadedFor: string;
  applicationListLoading: boolean;
  feedbackQueue: StaffFeedbackView[];
  selectedFeedbackId: string;
  selectedFeedback: FeedbackClientReceipt | null;
  selectedFeedbackLoading: boolean;
  selectedFeedbackError: string;
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
  feedbackDuplicate: { status: FeedbackStatus } | null;
  feedbackDuplicateOverride: boolean;
  showFeedbackForm: boolean;
  sandboxAcknowledged: boolean;
  applicationExperience: string;
  applicationAvailability: string;
  applicationConfirmed: boolean;
  pending: string;
  error: { message: string; requestId: string } | null;
  notice: string;
  emergencyMessage: string;
  voiceStatus: "idle" | "connecting" | "listening";
  voicePrompt: string;
  voiceError: string;
  chats: Record<ChatMode, ChatState>;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  historyOpen: boolean;
  historySearch: string;
  searchOpen: boolean;
  signInIntent: "resume" | "applications" | "profile" | "saved" | "staff" | "programs" | "external" | null;
}

const RECEIPT_KEY = "civicresolve.private-receipt.v1";
const SIGNIN_INTENT_KEY = "civicresolve.signin.intent.v1";
const EXTERNAL_RECORD_KEY = "civicresolve.external-record.v1";
const LOCAL_IDENTITIES = [
  ["", "local.identityNone"],
  ["dev-applicant", "local.applicant"],
  ["dev-civic-staff", "local.civicReviewer"],
  ["dev-hiring-reviewer", "local.hiringReviewer"],
  ["dev-organization-admin", "local.admin"],
] as const;

const state: AppState = {
  locale: readLocale(),
  programView: "discover",
  externalRecordId: sessionStorage.getItem(EXTERNAL_RECORD_KEY) ?? "",
  page: "assistant",
  applicationView: "browse",
  discoveryArea: "all",
  employeePage: "assistant",
  staffView: "overview",
  localIdentity: "",
  postings: [],
  postingsLoading: true,
  postingsError: "",
  selectedPostingId: "",
  applicantApplications: [],
  applicationListLoadedFor: "",
  applicationListLoading: false,
  feedbackQueue: [],
  selectedFeedbackId: "",
  selectedFeedback: null,
  selectedFeedbackLoading: false,
  selectedFeedbackError: "",
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
  feedbackDuplicate: null,
  feedbackDuplicateOverride: false,
  showFeedbackForm: !readReceiptCredentials(),
  sandboxAcknowledged: false,
  applicationExperience: "",
  applicationAvailability: "",
  applicationConfirmed: false,
  pending: "",
  error: null,
  notice: "",
  emergencyMessage: "",
  voiceStatus: "idle",
  voicePrompt: "",
  voiceError: "",
  chats: { resident: newChatState(), employee: newChatState() },
  sidebarOpen: false,
  sidebarCollapsed: false,
  historyOpen: true,
  historySearch: "",
  searchOpen: false,
  signInIntent: readSignInIntent(),
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root is missing.");
let voiceSession: { endSession(): Promise<void> } | null = null;
let voiceStartSerial = 0;
let voiceSessionToken: string | null = null;
let voiceSessionTarget: "feedback" | ChatMode = "feedback";
let lastAuthIdentity = "";
let staffSummary: StaffWorkspaceSummary | null = null;
let staffSummaryFor = "";
let staffSummaryError = "";

applyTokens();
render();
webAuth.subscribe((snapshot) => {
  const identity = snapshot.accessToken ?? "guest";
  if (identity !== lastAuthIdentity) {
    state.chats = { resident: newChatState(), employee: newChatState() };
    state.feedbackQueue = [];
    state.applicationQueue = [];
    state.applicantApplications = [];
    staffSummary = null;
    staffSummaryFor = "";
    staffSummaryError = "";
    lastAuthIdentity = identity;
  }
  state.applicationListLoadedFor = "";
  state.feedbackQueueLoadedFor = "";
  state.applicationQueueLoadedFor = "";
  if (snapshot.status === "authenticated") continueAfterSignIn();
  render();
  void loadRecent(activeChatMode());
});
void webAuth.initialize();
void loadRecent("resident");
void restoreChat("resident");
void loadPostings();
if (state.receiptCredentials) void refreshReceipt();

function readSignInIntent(): AppState["signInIntent"] {
  const value = sessionStorage.getItem(SIGNIN_INTENT_KEY);
  return value === "resume" || value === "applications" || value === "profile" || value === "saved" || value === "staff" || value === "programs" || value === "external"
    ? value : null;
}

function openSignIn(intent: AppState["signInIntent"] = null): void {
  state.signInIntent = intent;
  if (intent) sessionStorage.setItem(SIGNIN_INTENT_KEY, intent);
  else sessionStorage.removeItem(SIGNIN_INTENT_KEY);
  state.page = "signin";
  state.sidebarOpen = false;
  render();
}

function continueAfterSignIn(): void {
  const intent = state.signInIntent;
  if (!intent || !currentToken()) return;
  if (intent === "staff") {
    state.page = "employee";
    state.employeePage = "assistant";
  } else if (intent === "applications") {
    state.page = "applications";
    state.applicationView = "mine";
  }
  else if (intent === "saved") {
    state.page = "discovery";
    state.discoveryArea = "saved";
  } else if (intent === "resume") {
    state.page = "assistant";
    state.chats.resident.tray = "actions";
  } else if (intent === "programs") {
    state.page = "programs";
    state.programView = "discover";
  } else if (intent === "external" && state.externalRecordId) {
    state.page = "external-preparation";
  } else state.page = "profile";
  state.signInIntent = null;
  sessionStorage.removeItem(SIGNIN_INTENT_KEY);
}

function render(): void {
  if (state.page === "employee" && currentToken()) void ensureStaffSummary();
  document.documentElement.lang = state.locale;
  root!.replaceChildren();
  const shell = el(
    "div",
    `app-shell ${state.sidebarCollapsed ? "is-collapsed" : ""} ${state.sidebarOpen ? "sidebar-is-open" : ""}`,
  );
  const workspace = el("div", "workspace");
  shell.append(navigation());
  if (state.sidebarOpen) {
    const backdrop = button(t("app.closeMenu"), "sidebar-backdrop", () => {
      state.sidebarOpen = false;
      render();
    });
    backdrop.setAttribute("aria-label", t("app.closeMenu"));
    shell.append(backdrop);
  }
  workspace.append(header());
  workspace.append(mainPage());
  shell.append(workspace);
  shell.inert = state.searchOpen;
  root!.append(shell);
  if (state.searchOpen) root!.append(searchOverlay());
}

function header(): HTMLElement {
  const header = el("header", "topbar");
  const menu = button(t("app.openMenu"), "mobile-menu-button", () => {
    state.sidebarOpen = true;
    render();
    document.querySelector<HTMLButtonElement>(".sidebar-search-button")?.focus();
  });
  menu.setAttribute("aria-label", t("app.openMenu"));
  menu.setAttribute("aria-expanded", String(state.sidebarOpen));
  menu.replaceChildren(iconNode("menu"));
  header.append(menu);
  const heading = el("h1", "page-title", pageTitle());
  const breadcrumb = el("div", "breadcrumb");
  breadcrumb.append(
    el("span", "breadcrumb-parent", t("app.name")),
    el("span", "breadcrumb-separator", "/"),
    heading,
  );
  const controls = el("div", "topbar-controls");
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
    state.chats = { resident: newChatState(), employee: newChatState() };
    state.error = null;
    state.notice = "";
    state.receiptError = "";
    state.emergencyMessage = "";
    render();
    void loadRecent(activeChatMode());
    if (state.page === "assistant") void restoreChat("resident");
    if (state.page === "employee" && currentToken()) {
      if (state.employeePage === "assistant") void restoreChat("employee");
      else void loadEmployeeQueue();
    }
  });
  locale.append(select);
  controls.append(locale);
  header.append(breadcrumb, controls);
  return header;
}

function brand(): HTMLElement {
  const brand = el("a", "brand");
  brand.href = "/";
  brand.setAttribute("aria-label", t("app.name"));
  brand.append(
    el("span", "brand-mark"),
    el("span", "brand-name", t("app.name").toLowerCase()),
  );
  return brand;
}

function navigation(): HTMLElement {
  const sidebar = el("aside", "sidebar");
  sidebar.addEventListener("keydown", (event) => {
    if (!state.sidebarOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      state.sidebarOpen = false;
      render();
      document.querySelector<HTMLButtonElement>(".mobile-menu-button")?.focus();
    } else if (event.key === "Tab") trapTab(event, sidebar);
  });
  const head = el("div", "sidebar-head");
  const collapse = button(t("app.collapseMenu"), "sidebar-collapse", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    render();
  });
  collapse.replaceChildren(iconNode("panel"));
  collapse.setAttribute("aria-label", t("app.collapseMenu"));
  const searchButton = button(t("assistant.searchChats"), "sidebar-search-button", () => {
    state.searchOpen = true;
    state.sidebarOpen = false;
    render();
    document.querySelector<HTMLInputElement>(".search-dialog-input")?.focus();
  });
  searchButton.replaceChildren(iconNode("search"));
  searchButton.setAttribute("aria-label", t("assistant.searchChats"));
  head.append(brand(), searchButton, collapse);
  sidebar.append(head);

  const tools = el("div", "sidebar-tools");
  const newChat = sidebarAction("plus", t("assistant.newChat"), () => {
    const mode = activeChatMode();
    resetChat(mode);
    if (mode === "resident") state.page = "assistant";
    else {
      state.page = "employee";
      state.employeePage = "assistant";
    }
    state.sidebarOpen = false;
    render();
  });
  newChat.classList.add("sidebar-new-chat");
  tools.append(newChat);
  sidebar.append(tools);

  const nav = el("nav", "primary-nav");
  nav.setAttribute("aria-label", t("app.name"));
  if (state.page === "employee") {
    nav.append(sidebarHeading(t("sidebar.workspace")), staffSidebarAction("assistant", "chat", "nav.assistant"));
    const capabilities = staffSummary?.capabilities;
    if (capabilities?.feedbackRead) nav.append(
      staffViewAction("issues", "inbox", "sidebar.inbox"),
      staffViewAction("overview", "dashboard", "sidebar.overview"),
      staffViewAction("themes", "tags", "sidebar.themes"),
      staffViewAction("analytics", "chart", "sidebar.analytics"),
    );
    if (capabilities?.postingManage) nav.append(
      staffViewAction("hiring", "briefcase", "sidebar.hiring"),
      programButton("sponsor", "sidebar.programSponsor", "landmark"),
    );
    if (capabilities?.applicantReview) nav.append(staffViewAction("applicants", "users", "sidebar.applicants"));
    if (capabilities?.taxonomyManage) nav.append(
      sidebarAction("files", t("sidebar.sources"), () => void openPluginTool("employee", "list_sources")),
      staffViewAction("taxonomy", "taxonomy", "sidebar.taxonomy"),
    );
    if (capabilities?.auditRead) nav.append(staffViewAction("audit", "activity", "sidebar.analytics", state.locale === "fr" ? "Journal d’activité" : "Activity log"));
  } else {
    nav.append(
      sidebarHeading(t("sidebar.agent")),
      navButton("assistant", "nav.assistant", "chat"),
      sidebarHeading(t("sidebar.explore")),
      discoveryButton("jobs", "sidebar.jobs"),
      applicationButton("browse", "application.findRole", "briefcase"),
      discoveryButton("support", "sidebar.support"),
      discoveryButton("funding", "sidebar.funding"),
      programButton("discover", "sidebar.programs", "landmark"),
      discoveryButton("nearby", "sidebar.nearby"),
      discoveryButton("participation", "sidebar.participation"),
      navButton("feedback", "nav.feedback", "feedback"),
      sidebarHeading(t("sidebar.myActivity")),
      applicationButton("mine", "sidebar.myApplications", "clipboard"),
      discoveryButton("saved", "sidebar.saved"),
      programButton("mine", "sidebar.programRequests", "files"),
      navButton("profile", "sidebar.profile", "user"),
    );
    if (state.receiptCredentials) nav.append(navButton("feedback", "sidebar.myFeedback", "feedback"));
  }
  sidebar.append(nav);

  const history = el("section", "sidebar-history");
  const historyToggle = button(t("sidebar.recent"), "sidebar-section-label history-toggle", () => {
    state.historyOpen = !state.historyOpen;
    render();
  });
  historyToggle.setAttribute("aria-expanded", String(state.historyOpen));
  history.append(historyToggle);
  if (state.historyOpen) {
    const mode = activeChatMode();
    for (const item of state.chats[mode].history) {
      const row = button(item.label, "history-item", () => void openConversation(mode, item.id));
      row.dataset.historyLabel = item.label.toLowerCase();
      row.hidden = !row.dataset.historyLabel.includes(state.historySearch.toLowerCase());
      if (item.id === state.chats[mode].id) row.classList.add("is-active");
      history.append(row);
    }
  }
  sidebar.append(history);

  const footer = el("div", "sidebar-footer");
  const auth = webAuth.snapshot();
  if (auth.status === "authenticated") {
    footer.append(el("p", "sidebar-account", auth.displayName ?? t("auth.account")));
    footer.append(sidebarAction("logout", t("auth.signOut"), () => void webAuth.logout()));
  } else footer.append(sidebarAction("login", t(state.localIdentity ? "auth.changeAccount" : "auth.signIn"), () => openSignIn()));
  if (state.page === "employee") footer.append(navButton("assistant", "sidebar.residentView", "chat"));
  else {
    const staff = navButton("employee", "sidebar.staffView", "building");
    if (!currentToken()) disableGuestNavigation(staff);
    footer.append(staff);
  }
  sidebar.append(footer);
  return sidebar;
}

function searchOverlay(): HTMLElement {
  const overlay = el("div", "search-overlay");
  const close = () => {
    state.searchOpen = false;
    render();
    document.querySelector<HTMLButtonElement>(
      window.matchMedia("(max-width: 620px)").matches ? ".mobile-menu-button" : ".sidebar-search-button",
    )?.focus();
  };
  overlay.append(button(t("app.closeMenu"), "search-backdrop", close));
  const dialog = el("section", "search-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", t("assistant.searchChats"));
  const input = el("input", "search-dialog-input") as HTMLInputElement;
  input.type = "search";
  input.placeholder = t("assistant.searchChats");
  input.setAttribute("aria-label", t("assistant.searchChats"));
  input.value = state.historySearch;
  const list = el("div", "search-results");
  const entries = state.chats[activeChatMode()].history;
  for (const item of entries) {
    const row = button(item.label, "search-result", () => {
      state.searchOpen = false;
      void openConversation(activeChatMode(), item.id);
    });
    row.dataset.historyLabel = item.label.toLowerCase();
    list.append(row);
  }
  if (!entries.length) list.append(el("p", "search-empty", t("assistant.noRecentChats")));
  input.addEventListener("input", () => {
    state.historySearch = input.value;
    let visible = 0;
    for (const row of list.querySelectorAll<HTMLElement>("[data-history-label]")) {
      row.hidden = !row.dataset.historyLabel?.includes(input.value.toLowerCase());
      if (!row.hidden) visible++;
    }
    let empty = list.querySelector<HTMLElement>(".search-empty");
    if (!visible && !empty) {
      empty = el("p", "search-empty", t("assistant.noMatchingChats"));
      list.append(empty);
    }
    if (empty) empty.hidden = visible > 0;
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") trapTab(event, dialog);
  });
  dialog.append(input, el("span", "search-heading", t("sidebar.recent")), list);
  overlay.append(dialog);
  return overlay;
}

function trapTab(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
  )].filter((item) => !item.hidden && getComputedStyle(item).visibility !== "hidden");
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function disableGuestNavigation(item: HTMLButtonElement): void {
  item.disabled = true;
  item.setAttribute("aria-disabled", "true");
  item.title = t("auth.signInRequired");
}

function sidebarHeading(label: string): HTMLElement {
  return el("span", "sidebar-section-label", label);
}

function sidebarAction(icon: string, label: string, action: () => void): HTMLButtonElement {
  const result = button(label, "nav-item", action);
  result.setAttribute("aria-label", label);
  result.replaceChildren(iconNode(icon), el("span", "nav-label", label));
  return result;
}

function staffSidebarAction(page: EmployeePage, icon: string, key: MessageKey): HTMLButtonElement {
  const result = sidebarAction(icon, t(key), () => {
    state.employeePage = page;
    state.sidebarOpen = false;
    render();
    if (page === "assistant") void restoreChat("employee");
    if (page === "assistant") void loadRecent("employee");
    else if (currentToken()) void loadEmployeeQueue();
  });
  if (state.employeePage === page) result.classList.add("is-active");
  return result;
}

function staffViewAction(view: StaffView, icon: string, key: MessageKey, label = t(key)): HTMLButtonElement {
  const result = sidebarAction(icon, label, () => {
    state.page = "employee";
    state.employeePage = "feedback";
    state.staffView = view;
    state.selectedFeedbackId = "";
    state.selectedFeedback = null;
    state.sidebarOpen = false;
    render();
    if (view === "issues" && currentToken()) void loadEmployeeQueue();
  });
  if (state.page === "employee" && state.employeePage !== "assistant" && state.staffView === view && !state.selectedFeedbackId) result.classList.add("is-active");
  return result;
}

function discoveryButton(area: DiscoveryArea, labelKey: MessageKey): HTMLButtonElement {
  const icons: Record<DiscoveryArea, string> = {
    all: "search", jobs: "briefcase", support: "support", funding: "funding",
    nearby: "map", participation: "participation", saved: "bookmark",
  };
  const result = sidebarAction(icons[area], t(labelKey), () => {
    state.page = "discovery";
    state.discoveryArea = area;
    state.sidebarOpen = false;
    render();
  });
  if (state.page === "discovery" && state.discoveryArea === area) result.classList.add("is-active");
  if (area === "saved" && !currentToken()) disableGuestNavigation(result);
  return result;
}

function programButton(view: AppState["programView"], labelKey: MessageKey, icon: string): HTMLButtonElement {
  const item = sidebarAction(icon, t(labelKey), () => {
    state.page = "programs";
    state.programView = view;
    state.sidebarOpen = false;
    render();
  });
  if (state.page === "programs" && state.programView === view) item.classList.add("is-active");
  if (view !== "discover" && !currentToken()) disableGuestNavigation(item);
  return item;
}

function applicationButton(view: AppState["applicationView"], labelKey: MessageKey, icon: string): HTMLButtonElement {
  const item = sidebarAction(icon, t(labelKey), () => {
    state.page = "applications";
    state.applicationView = view;
    state.sidebarOpen = false;
    render();
  });
  if (state.page === "applications" && state.applicationView === view) item.classList.add("is-active");
  if (view === "mine" && !currentToken()) disableGuestNavigation(item);
  return item;
}

function navButton(
  page: Page,
  key: MessageKey,
  icon: string,
): HTMLButtonElement {
  const button = el(
    "button",
    `nav-item ${state.page === page ? "is-active" : ""}`,
  ) as HTMLButtonElement;
  button.type = "button";
  button.setAttribute("aria-current", state.page === page ? "page" : "false");
  button.append(iconNode(icon), el("span", "", t(key)));
  if ((page === "applications" || page === "profile" || page === "employee") && !currentToken()) disableGuestNavigation(button);
  button.addEventListener("click", () => {
    if (state.page === "feedback" && page !== "feedback") void stopVoice();
    state.page = page;
    state.sidebarOpen = false;
    state.error = null;
    state.notice = "";
    render();
    if (page === "applications") void loadMyApplications();
    if (page === "employee" && currentToken()) {
      void loadRecent("employee");
      if (state.employeePage === "assistant") void restoreChat("employee");
      else void loadEmployeeQueue();
    }
    if (page === "assistant") {
      void loadRecent("resident");
      void restoreChat("resident");
    }
  });
  return button;
}

function devIdentityPanel(): HTMLElement | null {
  if (!import.meta.env.DEV) return null;
  const panel = el("section", "local-identity");
  const copy = el("div", "local-identity-copy");
  copy.append(el("strong", "", t("local.identityLabel")));
  const select = el("select", "identity-select") as HTMLSelectElement;
  select.setAttribute("aria-label", t("local.identityLabel"));
  for (const [value, key] of LOCAL_IDENTITIES) {
    select.append(option(value, t(key), state.localIdentity));
  }
  select.addEventListener("change", () => {
    state.localIdentity = select.value;
    state.chats = { resident: newChatState(), employee: newChatState() };
    state.applicationListLoadedFor = "";
    state.feedbackQueueLoadedFor = "";
    state.applicationQueueLoadedFor = "";
    staffSummary = null;
    staffSummaryFor = "";
    staffSummaryError = "";
    if (state.localIdentity) {
      if (state.signInIntent) continueAfterSignIn();
      else if (state.localIdentity === "dev-applicant") state.page = "profile";
      else {
        state.page = "employee";
        state.employeePage = "assistant";
      }
    }
    render();
    void loadRecent(activeChatMode());
    if (state.page === "applications") void loadMyApplications();
    if (state.page === "assistant") void restoreChat("resident");
    if (state.page === "employee" && state.localIdentity) {
      if (state.employeePage === "assistant") void restoreChat("employee");
      else void loadEmployeeQueue();
    }
  });
  panel.append(copy, select);
  return panel;
}

function mainPage(): HTMLElement {
  const main = el("main", "page-wrap");
  if (state.error)
    main.append(alertBox(state.error.message, state.error.requestId));
  if (state.notice) main.append(alertBox(state.notice, "", "notice"));

  if (state.page === "assistant") main.append(chatPage("resident"));
  else if (state.page === "signin") main.append(signInPage());
  else if (state.page === "feedback") main.append(feedbackPage());
  else if (state.page === "applications") main.append(createPublicApplicationsPage({
    view: state.applicationView,
    locale: state.locale,
    token: currentToken() || null,
    onSignIn: () => openSignIn("applications"),
    onProfile: () => { state.page = "profile"; render(); },
    onPrepareExternal: openExternalPreparation,
  }));
  else if (state.page === "discovery" && state.discoveryArea === "participation") main.append(createParticipationPage({
    locale: state.locale,
    token: currentToken() || null,
  }));
  else if (state.page === "discovery") main.append(createDiscoveryPage({
    area: state.discoveryArea,
    locale: state.locale,
    token: currentToken() || null,
    onPrepare: openExternalPreparation,
  }));
  else if (state.page === "programs") main.append(createPublicProgramsPage({
    view: state.programView,
    locale: state.locale,
    token: currentToken() || null,
    organizationId: state.programView === "sponsor" ? currentOrgId() : null,
    onSignIn: () => openSignIn("programs"),
    onPrepareExternal: openExternalPreparation,
  }));
  else if (state.page === "external-preparation") main.append(createExternalPreparationPage({
    recordId: state.externalRecordId,
    locale: state.locale,
    token: currentToken() || null,
    onBack: () => { state.page = "discovery"; render(); },
    onSignIn: () => openSignIn("external"),
  }));
  else if (state.page === "profile") main.append(createProfilePage({ locale: state.locale, token: currentToken() || null }));
  else main.append(employeePage());
  return main;
}

function openExternalPreparation(recordId: string): void {
  state.externalRecordId = recordId;
  sessionStorage.setItem(EXTERNAL_RECORD_KEY, recordId);
  state.page = "external-preparation";
  render();
}

function signInPage(): HTMLElement {
  const page = el("section", "signin-page");
  const intro = el("div", "signin-intro");
  intro.append(el("h2", "", t("auth.welcome")), el("p", "", t("auth.intro")));
  if (state.signInIntent === "resume") intro.append(el("p", "signin-intent", t("auth.resumeIntent")));
  page.append(intro);
  const choices = el("div", "signin-choices");
  const personal = uiCard([], { className: "signin-choice" });
  personal.append(
    iconNode("user"),
    el("h3", "", t("auth.personal")),
    el("p", "", t("auth.personalDetail")),
    button(t("auth.continuePersonal"), "button-primary", () => void beginAuth("applicant")),
  );
  const staff = uiCard([], { className: "signin-choice" });
  staff.append(
    iconNode("building"),
    el("h3", "", t("auth.staff")),
    el("p", "", t("auth.staffDetail")),
    button(t("auth.continueStaff"), "button-secondary", () => void beginAuth("employee")),
  );
  if (webAuth.snapshot().status === "unconfigured") {
    for (const item of [personal, staff]) item.querySelector("button")!.disabled = true;
    page.append(el("p", "signin-unavailable", t("auth.unconfigured")));
  }
  choices.append(personal, staff);
  page.append(choices, el("p", "signin-guest-note", t("auth.guestAccess")));
  const identity = devIdentityPanel();
  if (identity) {
    const details = el("details", "signin-dev-access");
    details.append(el("summary", "", t("auth.localAccess")), identity);
    page.append(details);
  }
  return page;
}

async function beginAuth(mode: "applicant" | "employee"): Promise<void> {
  state.signInIntent = mode === "employee" ? "staff"
    : state.signInIntent && state.signInIntent !== "staff" ? state.signInIntent : "profile";
  sessionStorage.setItem(SIGNIN_INTENT_KEY, state.signInIntent);
  try {
    await webAuth.login(mode);
  } catch (error) {
    state.error = { message: error instanceof Error ? error.message : t("error.generic"), requestId: "" };
    render();
  }
}

function chatPage(mode: ChatMode): HTMLElement {
  const chat = state.chats[mode];
  const hasContent = chat.messages.length > 0 || chat.proposals.length > 0;
  const page = el("section", `chat-shell ${hasContent ? "has-messages" : "is-empty"}`);

  const thread = el("div", "chat-thread");
  thread.setAttribute("aria-live", "polite");
  if (!hasContent) {
    const welcome = el("div", "chat-welcome");
    welcome.append(el("h2", "", t("assistant.welcome")));
    thread.append(welcome);
  }
  for (const message of chat.messages) {
    if (message.role === "tool") {
      thread.append(agentResult(message.result ?? message.content, state.locale));
      continue;
    }
    const entry = el("article", `chat-message chat-${message.role}`);
    entry.append(
      el(
        "span",
        "chat-author",
        message.role === "user" ? t("assistant.you") : t("app.name"),
      ),
      el("p", "", message.content),
    );
    thread.append(entry);
  }
  for (const proposal of chat.proposals) {
    if (proposal.status === "pending") thread.append(proposalCard(mode, proposal));
    else thread.append(agentApprovalState({ status: proposal.status, preview: proposal.preview }, state.locale));
  }
  if (chat.pending) thread.append(loadingState());
  page.append(thread);

  if (chat.error) page.append(alertBox(chat.error, ""));
  const composeArea = el("div", "chat-compose-area");
  const composer = el("form", "chat-composer");
  const input = el("textarea", "chat-input") as HTMLTextAreaElement;
  input.rows = 3;
  input.maxLength = 4000;
  input.placeholder = t(mode === "employee" ? "assistant.staffPlaceholder" : "assistant.placeholder");
  input.setAttribute("aria-label", input.placeholder);
  input.value = chat.draft;
  input.addEventListener("input", () => (chat.draft = input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendChat(mode);
    }
  });
  const controls = el("div", "chat-composer-controls");
  const add = button("", "chat-round-button chat-add-button", () => void openChatTray(mode, "actions"));
  add.append(iconNode("plus"));
  add.setAttribute("aria-label", t("assistant.addToChat"));
  add.setAttribute("aria-expanded", String(chat.tray === "actions"));
  add.setAttribute("aria-haspopup", "true");
  const model = button("", "chat-model-button", () => {
    chat.modelOpen = !chat.modelOpen;
    if (!chat.modelOpen) chat.thinkingOpen = false;
    chat.tray = null;
    render();
    if (chat.modelOpen) document.querySelector<HTMLButtonElement>(".chat-model-option")?.focus();
    else document.querySelector<HTMLButtonElement>(".chat-model-button")?.focus();
  });
  model.append(el("span", "", t(chat.modelChoice === "fast" ? "assistant.modelFast" : "assistant.modelBalanced")), iconNode("chevron-down"));
  model.setAttribute("aria-haspopup", "dialog");
  model.setAttribute("aria-expanded", String(chat.modelOpen));
  const mic = button("", "chat-round-button chat-mic-button", () => {
    if (state.voiceStatus === "idle") void startVoice(mode);
    else void stopVoice();
  });
  mic.append(iconNode("mic"));
  mic.setAttribute("aria-label", t(state.voiceStatus === "idle" ? "voice.start" : "voice.stop"));
  if (state.voiceStatus !== "idle") mic.classList.add("is-listening");
  const send = button("", "chat-round-button chat-send-button", () => void sendChat(mode));
  send.append(iconNode("arrow-up"));
  send.setAttribute("aria-label", t("assistant.send"));
  send.disabled = chat.pending;
  controls.append(add, el("span", "chat-controls-spacer"), model, mic, send);
  composer.append(input, controls);
  if (chat.tray === "actions") composer.append(chatActionMenu(mode));
  if (chat.modelOpen) composer.append(chatModelMenu(mode));
  composer.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      composer.classList.add("is-dragging");
    }
  });
  composer.addEventListener("dragleave", () => composer.classList.remove("is-dragging"));
  composer.addEventListener("drop", (event) => {
    composer.classList.remove("is-dragging");
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    event.preventDefault();
    void handleResumeFile(mode, file);
  });
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendChat(mode);
  });
  composeArea.append(composer);
  if (!hasContent) composeArea.append(chatPromptCards(mode));
  if (chat.contextArea) composeArea.append(el("span", "chat-context-area", chat.contextArea));
  if (chat.savedResume) {
    const chip = el("div", "chat-resume-chip");
    chip.append(el("span", "", t("assistant.resumeSaved", { filename: chat.savedResume })));
    chip.append(button(t("assistant.openProfile"), "button-link", () => {
      state.page = "profile";
      render();
    }));
    composeArea.append(chip);
  }
  if (chat.tray && chat.tray !== "actions") composeArea.append(chatTray(mode));
  if (state.voiceError) composeArea.append(el("p", "voice-error", state.voiceError));
  if (state.voicePrompt && state.voiceStatus !== "idle") composeArea.append(el("p", "voice-prompt", state.voicePrompt));
  page.append(composeArea);
  return page;
}

function chatPromptCards(mode: ChatMode): HTMLElement {
  const suggestions: Array<{
    icon: string;
    color: string;
    title: MessageKey;
    detail: MessageKey;
    prompt: MessageKey;
  }> = mode === "resident"
    ? [
        { icon: "briefcase", color: "blue", title: "assistant.cardJobsTitle", detail: "assistant.cardJobsDetail", prompt: "assistant.cardJobsPrompt" },
        { icon: "map", color: "green", title: "assistant.cardSupportTitle", detail: "assistant.cardSupportDetail", prompt: "assistant.cardSupportPrompt" },
        { icon: "feedback", color: "orange", title: "assistant.cardIssueTitle", detail: "assistant.cardIssueDetail", prompt: "assistant.cardIssuePrompt" },
      ]
    : [
        { icon: "inbox", color: "blue", title: "assistant.cardInboxTitle", detail: "assistant.cardInboxDetail", prompt: "assistant.cardInboxPrompt" },
        { icon: "tags", color: "violet", title: "assistant.cardThemesTitle", detail: "assistant.cardThemesDetail", prompt: "assistant.cardThemesPrompt" },
        { icon: "users", color: "orange", title: "assistant.cardApplicantsTitle", detail: "assistant.cardApplicantsDetail", prompt: "assistant.cardApplicantsPrompt" },
      ];
  const section = el("section", "chat-prompt-section");
  section.append(el("h3", "", t("assistant.suggestionsHeading")));
  const grid = el("div", "chat-prompt-cards");
  for (const suggestion of suggestions) {
    const card = button("", `chat-prompt-card accent-${suggestion.color}`, () => {
      state.chats[mode].draft = t(suggestion.prompt);
      state.chats[mode].tray = null;
      render();
      const input = document.querySelector<HTMLTextAreaElement>(".chat-input");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    card.setAttribute("aria-label", `${t("assistant.tryPrompt")}: ${t(suggestion.title)}`);
    card.append(
      el("span", "chat-prompt-top",
        el("span", "chat-prompt-icon", iconNode(suggestion.icon)),
        el("span", "chat-prompt-try", t("assistant.tryPrompt")),
      ),
      el("span", "chat-prompt-copy",
        el("strong", "", t(suggestion.title)),
        el("small", "", t(suggestion.detail)),
      ),
    );
    grid.append(card);
  }
  section.append(grid);
  return section;
}

function chatActionMenu(mode: ChatMode): HTMLElement {
  const menu = el("div", "chat-action-menu");
  menu.setAttribute("role", "group");
  menu.setAttribute("aria-label", t("assistant.addToChat"));
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    state.chats[mode].tray = null;
    render();
    document.querySelector<HTMLButtonElement>(".chat-add-button")?.focus();
  });
  if (canUploadResume()) menu.append(resumeUploadControl(mode, "chat-action-item action-upload"));
  else {
    const upload = button(t("assistant.uploadResume"), "chat-action-item action-upload", () => openSignIn("resume"));
    upload.prepend(iconNode("files"));
    menu.append(upload);
  }
  const area = button(t("assistant.chooseArea"), "chat-action-item action-area", () => void openChatTray(mode, "area"));
  area.prepend(iconNode("map"));
  const plugins = button(t("assistant.plugins"), "chat-action-item action-tools", () => void openChatTray(mode, "plugins"));
  plugins.prepend(iconNode("plugins"));
  const feedback = button(t("nav.feedback"), "chat-action-item action-feedback", () => {
    state.page = "feedback";
    state.chats[mode].tray = null;
    render();
  });
  feedback.prepend(iconNode("feedback"));
  menu.append(area, plugins, feedback);
  return menu;
}

function chatModelMenu(mode: ChatMode): HTMLElement {
  const chat = state.chats[mode];
  const menu = el("div", "chat-model-menu");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", t("assistant.modelSettings"));
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    chat.modelOpen = false;
    chat.thinkingOpen = false;
    render();
    document.querySelector<HTMLButtonElement>(".chat-model-button")?.focus();
  });
  menu.append(el("span", "chat-model-menu-label", t("assistant.modelSettings")));
  for (const choice of ["balanced", "fast"] as const) {
    const selected = chat.modelChoice === choice;
    const option = button("", `chat-model-option ${selected ? "is-selected" : ""}`, () => {
      chat.modelChoice = choice;
      chat.modelOpen = false;
      chat.thinkingOpen = false;
      render();
      document.querySelector<HTMLButtonElement>(".chat-model-button")?.focus();
    });
    option.append(
      el("span", "chat-model-option-copy",
        el("strong", "", t(choice === "fast" ? "assistant.modelFast" : "assistant.modelBalanced")),
        el("small", "", t(choice === "fast" ? "assistant.modelFastDetail" : "assistant.modelBalancedDetail")),
      ),
    );
    if (selected) option.append(iconNode("check"));
    menu.append(option);
  }
  menu.append(el("p", "chat-model-note", t("assistant.modelDisplayOnly")));
  const thinking = button("", "chat-thinking-trigger", () => {
    chat.thinkingOpen = !chat.thinkingOpen;
    render();
  });
  thinking.append(
    el("span", "", t("assistant.thinking")),
    el("span", "chat-thinking-value", t("assistant.thinkingStandard")),
    iconNode("chevron-right"),
  );
  thinking.setAttribute("aria-expanded", String(chat.thinkingOpen));
  menu.append(thinking);
  if (chat.thinkingOpen) {
    const panel = el("div", "chat-thinking-panel");
    const track = el("div", "chat-thinking-track",
      el("span", "chat-thinking-dot"),
      el("span", "chat-thinking-dot is-current"),
      el("span", "chat-thinking-dot"),
    );
    const slider = el("input", "chat-thinking-range") as HTMLInputElement;
    slider.type = "range";
    slider.min = "0";
    slider.max = "2";
    slider.value = "1";
    slider.disabled = true;
    slider.setAttribute("aria-label", t("assistant.thinking"));
    track.append(slider);
    panel.append(
      el("strong", "", t("assistant.thinking")),
      track,
      el("span", "chat-thinking-setting", t("assistant.thinkingStandard")),
      el("p", "", t("assistant.thinkingFixed")),
    );
    menu.append(panel);
  }
  return menu;
}

function canUploadResume(): boolean {
  const auth = webAuth.snapshot();
  if (auth.status === "authenticated") return auth.mode === "applicant";
  return state.localIdentity === "dev-applicant";
}

function resumeUploadControl(mode: ChatMode, className: string): HTMLElement {
  const label = el("label", className);
  label.append(iconNode("files"), el("span", "", t("assistant.uploadResume")));
  const file = el("input") as HTMLInputElement;
  file.type = "file";
  file.accept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  file.setAttribute("aria-label", t("assistant.uploadResume"));
  file.addEventListener("change", () => {
    const selected = file.files?.[0];
    if (selected) void handleResumeFile(mode, selected);
  });
  label.append(file);
  return label;
}

function chatTray(mode: ChatMode): HTMLElement {
  const chat = state.chats[mode];
  const tray = el("div", "chat-tray");
  if (chat.tray === "area") {
    tray.append(
      el("p", "chat-tray-note", t("assistant.areaOnly")),
      button(t("assistant.areaToronto"), "chat-tray-choice", () => {
        chat.contextArea = "Toronto, Ontario";
        chat.tray = null;
        render();
      }),
    );
  } else if (chat.tray === "files") {
    if (canUploadResume()) {
      tray.append(el("p", "chat-tray-note", t("assistant.resumeUploadReady")));
      tray.append(resumeUploadControl(mode, "chat-file-label"));
    }
    else tray.append(button(t("assistant.signInForResume"), "chat-tray-choice", () => openSignIn("resume")));
  } else if (chat.tray === "plugins") {
    const search = el("input", "chat-tool-search") as HTMLInputElement;
    search.type = "search";
    search.placeholder = t("assistant.searchTools");
    search.setAttribute("aria-label", t("assistant.searchTools"));
    search.value = chat.toolSearch;
    search.addEventListener("input", () => {
      chat.toolSearch = search.value;
      for (const item of tray.querySelectorAll<HTMLElement>("[data-tool-search]")) {
        item.hidden = !item.dataset.toolSearch?.includes(search.value.toLowerCase());
      }
    });
    tray.append(search);
    if (!chat.tools.length && !chat.pending) tray.append(el("p", "chat-tray-note", t("assistant.noTools")));
    for (const tool of chat.tools) {
      const item = button(tool.description, "chat-tool-choice", () => void openPluginTool(mode, tool.name));
      item.dataset.toolSearch = `${tool.name} ${tool.description}`.toLowerCase();
      item.append(el("span", "chat-tool-action", t(tool.access === "read" ? "assistant.readTool" : "assistant.writeTool")));
      item.hidden = !item.dataset.toolSearch.includes(chat.toolSearch.toLowerCase());
      tray.append(item);
    }
  }
  return tray;
}

async function handleResumeFile(mode: ChatMode, file: File): Promise<void> {
  if (!/\.(pdf|docx)$/i.test(file.name)) {
    state.chats[mode].error = t("assistant.invalidResume");
    render();
    return;
  }
  if (!canUploadResume()) {
    openSignIn("resume");
    return;
  }
  await uploadChatResume(mode, file);
}

async function uploadChatResume(mode: ChatMode, file: File): Promise<void> {
  const chat = state.chats[mode];
  const token = currentToken();
  if (!token || chat.pending) return;
  chat.pending = true;
  chat.error = "";
  render();
  try {
    const response = await api.uploadResume(token, file);
    chat.savedResume = response.resume.filename;
    chat.tray = null;
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
  }
}

function proposalCard(mode: ChatMode, proposal: AgentProposal): HTMLElement {
  if (proposal.preview.name === "create_feedback") return feedbackProposalCard(mode, proposal);
  const card = el("section", "proposal-card");
  card.append(agentApprovalIntro(proposal.preview, state.locale));
  const changes = proposalChanges(proposal.preview.changes);
  if (changes) card.append(changes);
  else {
    const fields = proposalFields(proposal.preview.body);
    if (fields) card.append(fields);
  }
  if (proposal.preview.destinationNotice) {
    card.append(el("p", "proposal-notice", proposal.preview.destinationNotice));
  }
  if (proposal.preview.requiresSandboxAcknowledgment === true) {
    const acknowledgment = el("label", "checkbox-row proposal-ack");
    const check = el("input") as HTMLInputElement;
    check.type = "checkbox";
    check.checked = state.chats[mode].approvalChecked[proposal.id] === true;
    check.addEventListener("change", () => {
      state.chats[mode].approvalChecked[proposal.id] = check.checked;
      approve.disabled = state.chats[mode].pending || !check.checked;
    });
    acknowledgment.append(check, el("span", "", t("assistant.confirmPracticeDestination")));
    card.append(acknowledgment);
  }
  const actions = el("div", "form-actions");
  const decline = button(
    t("assistant.decline"),
    "button-quiet",
    () => void decideProposal(mode, proposal, false),
  );
  const approve = button(
    t("assistant.approve"),
    "button-primary",
    () => void decideProposal(mode, proposal, true),
  );
  approve.dataset.proposalApprove = "true";
  approve.disabled = state.chats[mode].pending ||
    (proposal.preview.requiresSandboxAcknowledgment === true && !state.chats[mode].approvalChecked[proposal.id]);
  decline.disabled = state.chats[mode].pending;
  actions.append(decline, approve);
  card.append(actions);
  return card;
}

function proposalChanges(value: unknown): HTMLElement | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rows = value.filter((item): item is Record<string, unknown> =>
    item !== null && typeof item === "object" && !Array.isArray(item) &&
    typeof item.field === "string" && item.field.trim().length > 0);
  if (rows.length === 0) return null;

  const section = el("div", "proposal-changes");
  section.append(el("p", "proposal-changes-title", t("assistant.proposedChanges")));
  const table = el("table", "proposal-changes-table");
  const head = el("thead");
  head.append(el("tr", "",
    el("th", "", t("assistant.changeField")),
    el("th", "", t("assistant.changeBefore")),
    el("th", "", t("assistant.changeAfter")),
  ));
  const body = el("tbody");
  for (const change of rows) {
    const row = el("tr");
    const field = el("th", "proposal-change-field", change.field as string);
    field.scope = "row";
    const before = el("td", "proposal-change-value", proposalChangeValue(change.before));
    before.dataset.label = t("assistant.changeBefore");
    const after = el("td", "proposal-change-value", proposalChangeValue(change.after));
    after.dataset.label = t("assistant.changeAfter");
    row.append(field, before, after);
    body.append(row);
  }
  table.append(head, body);
  section.append(table);
  return section;
}

function proposalChangeValue(value: unknown): string {
  if (value === null || value === undefined) return t("assistant.changeNoValue");
  if (typeof value === "string") return value.length > 0 ? value : t("assistant.changeEmptyText");
  if (typeof value === "boolean") return t(value ? "assistant.changeYes" : "assistant.changeNo");
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length === 0) return t("assistant.changeEmptyList");
  if (typeof value === "object" && Object.keys(value).length === 0) return t("assistant.changeEmptyObject");
  try { return JSON.stringify(value, null, 2) ?? t("assistant.changeNoValue"); }
  catch { return t("assistant.changeNoValue"); }
}

function proposalFields(value: unknown): HTMLElement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = el("div", "proposal-fields");
  for (const [key, item] of Object.entries(value)) {
    if (["locale", "sandboxAcknowledged", "organizationId", "requiresApproval", "expiresAt"].includes(key) || item === null || item === undefined) continue;
    const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
    const title = label.charAt(0).toUpperCase() + label.slice(1);
    const text = typeof item === "object" && !Array.isArray(item)
      ? Object.entries(item).map(([name, answer]) => `${name}: ${String(answer)}`).join("\n")
      : Array.isArray(item) ? item.map(String).join(", ") : String(item);
    fields.append(labeledValue(title, text));
  }
  return fields.childElementCount ? fields : null;
}

function feedbackProposalCard(mode: ChatMode, proposal: AgentProposal): HTMLElement {
  const chat = state.chats[mode];
  const raw = proposal.preview.body;
  const body = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  const original = typeof body.message === "string" ? body.message : "";
  const card = el("section", "proposal-card feedback-proposal");
  card.append(agentApprovalIntro(proposal.preview, state.locale));
  const editor = textArea(
    `proposal-message-${proposal.id}`,
    t("feedback.messageLabel"),
    t("feedback.messagePlaceholder"),
    chat.reportEdits[proposal.id] ?? original,
    (value) => { chat.reportEdits[proposal.id] = value; },
    4,
  );
  const input = editor.querySelector("textarea")!;
  input.maxLength = 4000;
  card.append(editor);
  if (typeof body.whatWouldImprove === "string" && body.whatWouldImprove.trim()) {
    card.append(labeledValue(t("feedback.improvementLabel"), body.whatWouldImprove));
  }
  card.append(el("p", "proposal-notice", t("assistant.reportDestination")));

  const duplicateStatus = typeof proposal.preview.duplicateStatus === "string"
    ? proposal.preview.duplicateStatus : null;
  let duplicateMatch: HTMLElement | null = null;
  if (proposal.preview.requiresDuplicateOverride === true && duplicateStatus) {
    duplicateMatch = el("section", "feedback-duplicate");
    duplicateMatch.append(
      el("h4", "", t("feedback.duplicateTitle")),
      el("p", "", t("feedback.duplicateExplanation")),
      el("div", "feedback-duplicate-status",
        el("span", "", t("feedback.duplicateStatus")),
        statusPill(duplicateStatus),
      ),
    );
    const separate = el("label", "checkbox-row");
    const confirm = el("input") as HTMLInputElement;
    confirm.type = "checkbox";
    confirm.checked = chat.duplicateOverrideChecked[proposal.id] === true;
    confirm.addEventListener("change", () => {
      chat.duplicateOverrideChecked[proposal.id] = confirm.checked;
      updateButton();
    });
    separate.append(confirm, el("span", "", t("feedback.separateIssue")));
    duplicateMatch.append(separate);
    card.append(duplicateMatch);
  }

  const acknowledgment = el("label", "checkbox-row proposal-ack");
  const check = el("input") as HTMLInputElement;
  check.type = "checkbox";
  check.checked = chat.approvalChecked[proposal.id] === true;
  check.addEventListener("change", () => {
    chat.approvalChecked[proposal.id] = check.checked;
    updateButton();
  });
  acknowledgment.append(check, el("span", "", t("assistant.confirmDestination")));
  card.append(acknowledgment);

  const actions = el("div", "form-actions");
  const decline = button(t("assistant.decline"), "button-quiet", () => void decideProposal(mode, proposal, false));
  const approve = button("", "button-primary", () => {
    const edited = input.value.trim() !== original.trim();
    if (edited) void prepareEditedFeedback(mode, proposal, input.value.trim());
    else void decideProposal(mode, proposal, true);
  });
  approve.dataset.proposalApprove = "true";
  function updateButton(): void {
    const edited = input.value.trim() !== original.trim();
    acknowledgment.hidden = edited;
    if (duplicateMatch) duplicateMatch.hidden = edited;
    approve.textContent = t(edited ? "assistant.reviewUpdatedReport"
      : duplicateMatch ? "feedback.submitSeparate" : "assistant.confirmReport");
    approve.disabled = chat.pending || !input.value.trim() ||
      (!edited && (!chat.approvalChecked[proposal.id] ||
        Boolean(duplicateMatch && !chat.duplicateOverrideChecked[proposal.id])));
  }
  input.addEventListener("input", updateButton);
  updateButton();
  decline.disabled = chat.pending;
  actions.append(decline, approve);
  card.append(actions);
  return card;
}

function chatCredentials(mode: ChatMode): {
  accessToken?: string;
  conversationToken?: string;
  receiptToken?: string;
} {
  const token = currentToken();
  return {
    ...(token ? { accessToken: token } : {}),
    ...(state.chats[mode].token
      ? { conversationToken: state.chats[mode].token }
      : {}),
    ...(state.receiptCredentials
      ? { receiptToken: state.receiptCredentials.receiptToken }
      : {}),
  };
}

function chatStorageKey(mode: ChatMode): string {
  return `civicresolve.chat.${mode}.${currentToken() || "guest"}.${state.locale}.v1`;
}

function historyStorageKey(mode: ChatMode): string {
  return `${chatStorageKey(mode)}.recent`;
}

function activeChatMode(): ChatMode {
  return state.page === "employee" ? "employee" : "resident";
}

function readLocalHistory(mode: ChatMode): ChatHistoryEntry[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(historyStorageKey(mode)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ChatHistoryEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      return typeof item.id === "string" &&
        /^conv_[a-f0-9]{32}$/.test(item.id) &&
        typeof item.label === "string" &&
        typeof item.updatedAt === "string";
    }).slice(0, 30);
  } catch {
    return [];
  }
}

function rememberConversation(mode: ChatMode, label: string): void {
  const chat = state.chats[mode];
  if (!chat.id) return;
  const existing = chat.history.find((item) => item.id === chat.id);
  const entry: ChatHistoryEntry = {
    id: chat.id,
    label: existing?.label && existing.label !== t("assistant.conversation")
      ? existing.label
      : label.slice(0, 54),
    updatedAt: new Date().toISOString(),
    ...(chat.token ? { token: chat.token } : {}),
  };
  chat.history = [entry, ...chat.history.filter((item) => item.id !== chat.id)].slice(0, 30);
  sessionStorage.setItem(historyStorageKey(mode), JSON.stringify(chat.history));
}

async function loadRecent(mode: ChatMode): Promise<void> {
  const chat = state.chats[mode];
  if (chat.historyLoaded) return;
  chat.historyLoaded = true;
  const local = readLocalHistory(mode);
  chat.history = local;
  if (currentToken()) {
    try {
      const response = await api.listConversations(currentToken());
      const server = response.conversations.filter((item) => item.mode === mode && item.locale === state.locale);
      chat.history = server.map((item) => {
        const stored = local.find((entry) => entry.id === item.id);
        return stored ?? { id: item.id, label: `${t("assistant.conversation")} · ${formatDate(item.updatedAt)}`, updatedAt: item.updatedAt };
      });
    } catch {
      chat.history = local;
    }
  }
  render();
}

async function ensureConversation(mode: ChatMode): Promise<void> {
  const chat = state.chats[mode];
  if (chat.id) return;
  const created = await api.createConversation(mode, state.locale, chatCredentials(mode));
  chat.id = created.conversation.id;
  chat.token = created.conversationToken ?? "";
  chat.tools = created.tools;
  sessionStorage.setItem(chatStorageKey(mode), JSON.stringify({ id: chat.id, token: chat.token }));
  rememberConversation(mode, t("assistant.conversation"));
}

async function openConversation(mode: ChatMode, id: string): Promise<void> {
  const chat = state.chats[mode];
  if (chat.pending) return;
  const entry = chat.history.find((item) => item.id === id);
  if (!entry) return;
  chat.id = id;
  chat.token = entry.token ?? "";
  chat.pending = true;
  chat.error = "";
  chat.tray = null;
  state.sidebarOpen = false;
  sessionStorage.setItem(chatStorageKey(mode), JSON.stringify({ id, token: chat.token }));
  render();
  try {
    const response = await api.getConversation(id, chatCredentials(mode));
    chat.messages = response.messages.map(({ role, content }) => ({ role, content }));
    chat.proposals = response.proposals;
    chat.tools = response.tools;
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
  }
}

async function openChatTray(mode: ChatMode, tray: ChatState["tray"]): Promise<void> {
  if (mode === "employee" && !currentToken()) {
    state.page = "employee";
    state.employeePage = "assistant";
    state.sidebarOpen = false;
    render();
    return;
  }
  if (mode === "resident") state.page = "assistant";
  else {
    state.page = "employee";
    state.employeePage = "assistant";
  }
  const chat = state.chats[mode];
  chat.tray = chat.tray === tray ? null : tray;
  chat.modelOpen = false;
  chat.thinkingOpen = false;
  state.sidebarOpen = false;
  render();
  if (tray === "actions") {
    if (chat.tray) document.querySelector<HTMLElement>(".chat-action-menu input[type=file],.chat-action-menu button")?.focus();
    else document.querySelector<HTMLButtonElement>(".chat-add-button")?.focus();
  }
  if (chat.tray === "plugins" && chat.tools.length === 0) {
    chat.pending = true;
    render();
    try {
      await ensureConversation(mode);
    } catch (error) {
      chat.error = formatError(error).message;
    } finally {
      chat.pending = false;
      render();
    }
  }
}

const DIRECT_READ_TOOLS = new Set([
  "list_postings", "list_sources", "list_source_records", "read_profile", "list_resumes",
  "list_my_applications", "list_staff_feedback", "read_feedback_analytics",
  "list_staff_applications", "read_taxonomy", "list_taxonomy_versions", "prepare_resume_upload",
]);

async function openPluginTool(mode: ChatMode, name: string): Promise<void> {
  await openChatTray(mode, "plugins");
  const chat = state.chats[mode];
  const tool = chat.tools.find((item) => item.name === name);
  if (!tool) {
    chat.error = t("assistant.toolUnavailable");
    render();
    return;
  }
  if (tool.access !== "read" || !DIRECT_READ_TOOLS.has(name)) {
    chat.draft = t("assistant.toolPrompt", { action: tool.description });
    chat.tray = null;
    render();
    document.querySelector<HTMLTextAreaElement>(".chat-input")?.focus();
    return;
  }
  chat.pending = true;
  chat.error = "";
  chat.tray = null;
  render();
  try {
    await ensureConversation(mode);
    const response = await api.invokeConversationTool(chat.id, chatCredentials(mode), name);
    if (response.result !== undefined) {
      if (isResumeUploadHandoff(response.result)) {
        chat.messages.push({ role: "assistant", content: t("assistant.resumeUploadReady") });
        chat.tray = "files";
      } else chat.messages.push({ role: "tool", content: visibleToolResult(response.result), result: response.result });
    }
    if (response.proposal) chat.proposals.push(response.proposal);
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
    if (chat.tray === "files") focusResumeUpload();
  }
}

function resetChat(mode: ChatMode): void {
  sessionStorage.removeItem(chatStorageKey(mode));
  const history = state.chats[mode].history;
  state.chats[mode] = newChatState();
  state.chats[mode].history = history;
  state.chats[mode].historyLoaded = true;
  render();
}

async function restoreChat(mode: ChatMode): Promise<void> {
  if (mode === "employee" && !currentToken()) return;
  const chat = state.chats[mode];
  if (chat.id || chat.pending) return;
  let saved: { id?: string; token?: string } | null = null;
  try {
    saved = JSON.parse(
      sessionStorage.getItem(chatStorageKey(mode)) ?? "null",
    ) as { id?: string; token?: string } | null;
  } catch {
    sessionStorage.removeItem(chatStorageKey(mode));
  }
  if (!saved?.id || !/^conv_[a-f0-9]{32}$/.test(saved.id)) return;
  chat.id = saved.id;
  chat.token = typeof saved.token === "string" ? saved.token : "";
  chat.pending = true;
  render();
  try {
    const response = await api.getConversation(chat.id, chatCredentials(mode));
    chat.messages = response.messages.map(({ role, content }) => ({
      role,
      content,
    }));
    chat.proposals = response.proposals;
    chat.tools = response.tools;
  } catch (error) {
    if (error instanceof WorkerApiError && error.status === 404) {
      sessionStorage.removeItem(chatStorageKey(mode));
      state.chats[mode] = newChatState();
      state.chats[mode].error = t("assistant.sessionExpired");
    } else chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
  }
}

async function sendChat(mode: ChatMode): Promise<void> {
  const chat = state.chats[mode];
  const draft = chat.draft.trim();
  const message = chat.contextArea ? `For ${chat.contextArea}: ${draft}` : draft;
  if (!draft || chat.pending) return;
  if (mode === "employee" && !currentToken()) {
    chat.error = t("error.unauthenticated");
    render();
    return;
  }
  chat.draft = "";
  chat.error = "";
  chat.pending = true;
  chat.messages.push({ role: "user", content: message });
  render();
  try {
    await ensureConversation(mode);
    const response = await api.sendConversationMessage(
      chat.id,
      chatCredentials(mode),
      message,
    );
    chat.messages.push({ role: "assistant", content: response.message });
    if (response.toolResult !== undefined && !feedbackDuplicateStatusFromResult(response.toolResult)) {
      if (isResumeUploadHandoff(response.toolResult)) chat.tray = "files";
      else chat.messages.push({
          role: "tool",
          content: visibleToolResult(response.toolResult),
          result: response.toolResult,
        });
    }
    if (response.proposal) chat.proposals.push(response.proposal);
    rememberConversation(mode, message);
  } catch (error) {
    chat.error = formatError(error).message;
    chat.draft = draft;
    chat.messages.pop();
  } finally {
    chat.pending = false;
    render();
    if (chat.tray === "files") focusResumeUpload();
  }
}

async function decideProposal(
  mode: ChatMode,
  proposal: AgentProposal,
  approved: boolean,
): Promise<void> {
  const chat = state.chats[mode];
  if (!chat.id || chat.pending) return;
  if (approved && proposal.preview.name === "create_feedback") {
    const body = proposal.preview.body;
    const original = body && typeof body === "object" && "message" in body
      ? String(body.message) : "";
    const edit = chat.reportEdits[proposal.id];
    if (edit !== undefined && edit.trim() !== original.trim()) return;
  }
  const needsSandboxAcknowledgment = proposal.preview.requiresSandboxAcknowledgment === true ||
    proposal.preview.name === "create_feedback";
  const sandboxAcknowledged = needsSandboxAcknowledgment &&
    chat.approvalChecked[proposal.id] === true;
  if (
    approved &&
    needsSandboxAcknowledgment &&
    !sandboxAcknowledged
  )
    return;
  const duplicateOverride = approved && proposal.preview.name === "create_feedback" &&
    proposal.preview.requiresDuplicateOverride === true &&
    chat.duplicateOverrideChecked[proposal.id] === true;
  if (approved && proposal.preview.requiresDuplicateOverride === true && !duplicateOverride)
    return;
  chat.pending = true;
  chat.error = "";
  render();
  try {
    const response = await api.decideConversationProposal(
      chat.id,
      proposal.id,
      approved ? "approve" : "reject",
      chatCredentials(mode),
      sandboxAcknowledged,
      duplicateOverride,
    );
    const duplicateStatus = approved && proposal.preview.name === "create_feedback"
      ? feedbackDuplicateStatusFromResult(response.result) : null;
    if (duplicateStatus) {
      proposal.status = "pending";
      proposal.preview = {
        ...proposal.preview,
        ...response.proposal.preview,
        requiresDuplicateOverride: true,
        duplicateStatus,
      };
      chat.duplicateOverrideChecked[proposal.id] = false;
      return;
    }
    proposal.status = approved ? "approved" : "rejected";
    chat.messages.push({
      role: "assistant",
      content: t(
        approved ? "assistant.actionCompleted" : "assistant.actionDeclined",
      ),
    });
    if (approved && proposal.preview.name === "create_feedback")
      saveApprovedChatReceipt(response.result);
    if (approved && response.result !== undefined) {
      chat.messages.push({
        role: "tool",
        content: visibleToolResult(response.result),
        result: response.result,
      });
    }
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
  }
}

function feedbackDuplicateStatusFromResult(result: unknown): FeedbackStatus | null {
  if (!result || typeof result !== "object") return null;
  const data = (result as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const outcome = data as { result?: unknown; created?: unknown; duplicate?: { status?: unknown } };
  if (outcome.result !== "duplicate" || outcome.created !== false) return null;
  const status = outcome.duplicate?.status;
  return typeof status === "string" && [
    "submitted", "acknowledged", "in_review", "waiting_on_resident",
    "outcome_recorded", "closed", "reopened",
  ].includes(status) ? status as FeedbackStatus : null;
}

async function prepareEditedFeedback(mode: ChatMode, previous: AgentProposal, message: string): Promise<void> {
  const chat = state.chats[mode];
  if (!chat.id || chat.pending || !message) return;
  const raw = previous.preview.body;
  const body = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  if (typeof body.municipalityId !== "string") {
    chat.error = t("error.invalidRequest");
    render();
    return;
  }
  const args: Record<string, unknown> = {
    message,
    municipalityId: body.municipalityId,
    locale: state.locale,
    sandboxAcknowledged: false,
  };
  if (typeof body.whatWouldImprove === "string") args.whatWouldImprove = body.whatWouldImprove;
  if (typeof body.category === "string") args.category = body.category;
  chat.pending = true;
  chat.error = "";
  render();
  try {
    const next = await api.invokeConversationTool(chat.id, chatCredentials(mode), "create_feedback", args);
    if (!next.proposal) throw new Error(t("assistant.unavailable"));
    chat.proposals.push(next.proposal);
    await api.decideConversationProposal(chat.id, previous.id, "reject", chatCredentials(mode));
    previous.status = "rejected";
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
  }
}

function saveApprovedChatReceipt(result: unknown): void {
  if (!result || typeof result !== "object") return;
  const data = (result as { data?: unknown }).data;
  if (!data || typeof data !== "object") return;
  const object = data as {
    submission?: { id?: unknown };
    receiptToken?: unknown;
  };
  if (
    typeof object.submission?.id !== "string" ||
    typeof object.receiptToken !== "string"
  )
    return;
  state.receiptCredentials = {
    submissionId: object.submission.id,
    receiptToken: object.receiptToken,
  };
  storeReceiptCredentials(state.receiptCredentials);
  void refreshReceipt(false);
}

function isResumeUploadHandoff(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const result = value as { status?: unknown; data?: unknown };
  if (result.status !== 200 || !result.data || typeof result.data !== "object") return false;
  const upload = (result.data as { upload?: unknown }).upload;
  if (!upload || typeof upload !== "object") return false;
  const details = upload as Record<string, unknown>;
  return details.path === "/api/v1/profile/resumes" &&
    details.method === "POST" && details.field === "file" &&
    details.requiresFileChooser === true && details.submitted === false;
}

function focusResumeUpload(): void {
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(".chat-file-label input[type=file]");
    input?.focus();
    input?.closest(".chat-tray")?.scrollIntoView({ block: "nearest" });
  });
}

function visibleToolResult(value: unknown): string {
  return JSON.stringify(
    value,
    (key, item) => {
      if (/token|authorization|secret/i.test(key)) return "[private]";
      return item;
    },
    2,
  ).slice(0, 12_000);
}

function feedbackPage(): HTMLElement {
  if (state.receipt && !state.showFeedbackForm) {
    return createResidentFeedbackCase({
      receipt: state.receipt,
      locale: state.locale,
      error: state.receiptError || state.error?.message || "",
      busy: Boolean(state.pending),
      onRefresh: () => void refreshReceipt(),
      onReply: (message) => void submitResidentFollowUp(message),
      onReopen: (message) => void reopenResidentCase(message),
      onNew: () => {
        state.showFeedbackForm = true;
        render();
      },
    });
  }
  const layout = el("div", "two-column feedback-flow");
  const left = el("section", "surface primary-surface feedback-main");
  if (state.receipt && !state.showFeedbackForm) {
    left.append(
      receiptPanel(),
      button(t("feedback.newReport"), "button-quiet", () => {
        state.showFeedbackForm = true;
        render();
      }),
    );
  } else {
    const intro = el("div", "feedback-intro",
      el("div", "feedback-intro-icon", iconNode("feedback")),
      el("div", "", el("h2", "", t("feedback.heading")), el("p", "", t("feedback.shortIntro"))),
    );
    const steps = el("div", "feedback-steps",
      el("span", state.feedbackReviewing ? "" : "is-current", t("feedback.stepWrite")),
      el("span", "feedback-step-rule"),
      el("span", state.feedbackReviewing ? "is-current" : "", t("feedback.stepReview")),
    );
    steps.querySelectorAll("span:not(.feedback-step-rule)").forEach((step, index) => {
      (step as HTMLElement).dataset.step = String(index + 1);
    });
    left.append(intro, steps);
    if (state.feedbackReviewing) left.append(feedbackReview());
    else left.append(feedbackForm());
    if (state.receipt) left.append(receiptPanel());
  }

  const aside = el("aside", "surface context-surface feedback-aside feedback-aside-card");
  const emergency = el("div", "emergency-note");
  emergency.append(
    el("strong", "", t("feedback.emergencyTitle")),
    el("p", "", t("feedback.emergencyNote")),
    button(
      t("feedback.emergencyAction"),
      "button-link",
      () => void showEmergencyGuidance(),
    ),
  );
  if (state.emergencyMessage) {
    const guidance = el("p", "emergency-guidance", state.emergencyMessage);
    const call = el("a", "emergency-call", t("feedback.call911"));
    call.href = "tel:911";
    emergency.append(guidance, call);
  }
  aside.append(
    el("h2", "aside-title", t("feedback.aboutThisService")),
    el("p", "", t("feedback.privacyNotice")),
    emergency,
  );
  layout.append(left, aside);
  return layout;
}

function feedbackCaseDetail(receipt: FeedbackClientReceipt, mode: "resident" | "staff"): HTMLElement {
  const layout = el("div", "case-layout");
  const main = el("section", "case-main");
  const heading = el("div", "case-heading");
  const title = receipt.originalText.match(/^[^\n.!?]+[.!?]?/)?.[0]?.trim() || t("feedback.receiptTitle");
  heading.append(
    el("span", "case-key", receipt.id),
    el("h2", "case-title", title.slice(0, 120)),
  );
  if (title !== receipt.originalText || title.length > 120) heading.append(el("p", "case-original", receipt.originalText));
  if (receipt.constructiveFollowUp) {
    heading.append(el("p", "case-improvement", receipt.constructiveFollowUp));
  }
  main.append(heading, el("h3", "case-section-title", t("feedback.activity")));
  const timeline = el("div", "case-timeline");
  for (const message of receipt.messages) {
    if (message.author === "resident" && message.body === receipt.originalText) continue;
    const row = el("article", "case-event");
    row.append(
      el("span", "case-event-dot"),
      el("div", "case-event-body",
        el("div", "case-event-meta",
          el("strong", "", message.author === "staff" ? t("feedback.staffReply") : t("assistant.you")),
          el("time", "", formatDate(message.createdAt)),
        ),
        el("p", "", message.body),
      ),
    );
    timeline.append(row);
  }
  if (!timeline.childElementCount) timeline.append(el("p", "quiet-note", t("feedback.noActivity")));
  main.append(timeline);
  if (mode === "resident" && state.receiptCredentials && receipt.status !== "closed") {
    const reply = textArea("resident-follow-up", t("feedback.followUpLabel"), t("feedback.replyPlaceholder"), "", () => {}, 2);
    const form = el("form", "case-reply");
    form.append(reply, button(t("feedback.replySend"), "button-primary", () => void submitResidentFollowUp(reply.querySelector("textarea")?.value ?? "")));
    form.addEventListener("submit", (event) => event.preventDefault());
    main.append(form);
  }
  if (mode === "staff") main.append(staffCaseActions(receipt));
  const properties = el("aside", "case-properties");
  properties.append(el("h3", "case-section-title", t("feedback.properties")));
  const props: Array<[MessageKey, string]> = [
    ["feedback.receiptStatus", statusName(receipt.status)],
    ["feedback.category", receipt.category.replaceAll("_", " ")],
    ["feedback.department", receipt.departmentName ?? "—"],
    ["feedback.destination", receipt.destinationLabel ?? "—"],
    ["feedback.municipality", receipt.municipality?.name ?? "—"],
    ["feedback.evidence", String(receipt.evidence.length)],
  ];
  for (const [key, value] of props) {
    properties.append(el("div", "case-property", el("span", "", t(key)), el("strong", "", value)));
  }
  if (receipt.outcome) properties.append(el("div", "case-property", el("span", "", t("feedback.outcome")), el("p", "", receipt.outcome)));
  for (const evidence of receipt.evidence) properties.append(el("span", "case-evidence", evidence.fileName));
  if (mode === "staff") properties.append(staffFeedbackOperations({
    token: currentToken(),
    organizationId: currentOrgId(),
    locale: state.locale,
    submission: {
      id: receipt.id,
      status: receipt.status,
      assignment: (receipt as FeedbackClientReceipt & {
        assignment?: { departmentId: string; departmentName: string; assigneeSubject: string | null } | null;
      }).assignment,
    },
    onChanged: async () => {
      await refreshStaffCase(receipt.id);
      await loadEmployeeQueue();
    },
  }));
  if (mode === "resident") properties.append(el("p", "quiet-note", t("feedback.receiptSecretHelp")));
  layout.append(main, properties);
  return layout;
}

function staffCaseActions(receipt: FeedbackClientReceipt): HTMLElement {
  const actions = el("div", "case-staff-actions");
  const reply = textArea(`staff-detail-reply-${receipt.id}`, t("feedback.reply"), t("feedback.replyPlaceholder"), "", () => {}, 2);
  const respond = button(t("feedback.replySend"), "button-primary", () => {
    const message = reply.querySelector("textarea")?.value.trim() ?? "";
    if (!message) return;
    void withPending(`detail-reply-${receipt.id}`, async () => {
      await api.replyToFeedback(currentToken(), currentOrgId(), receipt.id, message);
      await refreshStaffCase(receipt.id);
    });
  });
  respond.disabled = state.pending === `detail-reply-${receipt.id}`;
  actions.append(reply, respond);
  const remaining = nextFeedbackStatuses(receipt.status).filter((value) =>
    value !== "waiting_on_resident" && value !== "outcome_recorded");
  if (!remaining.length) return actions;
  const status = selectStatuses(remaining, receipt.status, "feedback.nextStatus");
  const update = button(t("feedback.updateStatus"), "button-secondary", () => {
    void withPending(`detail-status-${receipt.id}`, async () => {
      await api.changeFeedbackStatus(currentToken(), currentOrgId(), receipt.id, status.value as FeedbackStatus, "");
      await refreshStaffCase(receipt.id);
      await loadEmployeeQueue();
    });
  });
  update.disabled = state.pending === `detail-status-${receipt.id}`;
  actions.append(status, update);
  return actions;
}

async function refreshStaffCase(id: string): Promise<void> {
  state.selectedFeedbackLoading = true;
  state.selectedFeedbackError = "";
  render();
  try {
    const result = await api.getStaffFeedbackDetail(currentToken(), currentOrgId(), id);
    if (state.selectedFeedbackId === id) state.selectedFeedback = result.submission;
  } catch (error) {
    state.selectedFeedbackError = formatError(error).message;
  } finally {
    state.selectedFeedbackLoading = false;
    render();
  }
}

function feedbackForm(): HTMLElement {
  const form = el("form", "form-stack feedback-form feedback-panel");
  const voice = el("div", "voice-controls");
  if (state.voiceStatus === "idle") {
    voice.append(
      button(t("voice.start"), "button-secondary", () => void startVoice()),
    );
  } else {
    const stop = button(
      t("voice.stop"),
      "button-secondary",
      () => void stopVoice(),
    );
    stop.disabled = state.voiceStatus === "connecting";
    voice.append(
      stop,
      el(
        "span",
        "voice-status",
        t(
          state.voiceStatus === "connecting"
            ? "voice.connecting"
            : "voice.listening",
        ),
      ),
    );
  }
  if (state.voiceError)
    voice.append(el("span", "voice-error", state.voiceError));
  voice.append(el("p", "voice-prompt", state.voicePrompt));
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
  form.append(el("div", "feedback-panel-head",
    el("h3", "", t("feedback.formHeading")),
    el("p", "", t("feedback.formHint")),
  ));
  form.append(message, el("div", "feedback-input-tools", voice));
  const extra = el("details", "feedback-extra");
  extra.open = Boolean(state.feedbackImprovement.trim());
  extra.append(el("summary", "", t("feedback.addSuggestion")),
    el("div", "feedback-extra-body", improvement));
  form.append(extra);
  const actions = el("div", "form-actions");
  const review = button(t("feedback.review"), "button-primary", () => void checkFeedbackBeforeReview());
  review.disabled = state.pending === "feedback-check" || state.pending === "feedback";
  if (state.pending === "feedback-check") review.prepend(spinner());
  actions.append(review);
  form.append(el("div", "feedback-form-footer",
    el("p", "", t("feedback.reviewHint")), actions));
  form.addEventListener("submit", (event) => event.preventDefault());
  return form;
}

async function startVoice(target: "feedback" | ChatMode = "feedback"): Promise<void> {
  if (state.voiceStatus !== "idle") return;
  const serial = ++voiceStartSerial;
  state.voiceStatus = "connecting";
  state.voiceError = "";
  render();
  try {
    const signed = await api.createVoiceSession(state.locale);
    if (serial !== voiceStartSerial) return;
    voiceSessionToken = signed.voiceSessionToken;
    voiceSessionTarget = target;
    const { Conversation } = await import("@elevenlabs/client");
    if (serial !== voiceStartSerial) return;
    const session = await Conversation.startSession({
      signedUrl: signed.signedUrl,
      connectionType: "websocket",
      userId: signed.voiceSessionToken,
      dynamicVariables: { secret__envoy_voice_token: signed.voiceSessionToken },
      onMessage: ({ role, message }) => {
        if (serial !== voiceStartSerial) return;
        if (role === "user") {
          if (/^(yes|oui)[,\s]*(please\s+)?(send|submit|envoyer|soumettre)(\s+(it|this|le|la|ça))?[.!\s]*$/i.test(message.trim())) return;
          if (target === "feedback") {
            state.feedbackDraft = [state.feedbackDraft, message].filter(Boolean).join("\n");
            const field = document.querySelector<HTMLTextAreaElement>("#feedback-message");
            if (field) field.value = state.feedbackDraft;
          } else {
            const chat = state.chats[target];
            chat.draft = [chat.draft, message].filter(Boolean).join("\n");
            const field = document.querySelector<HTMLTextAreaElement>(".chat-input");
            if (field) field.value = chat.draft;
          }
        } else {
          state.voicePrompt = message;
          const prompt = document.querySelector<HTMLElement>(".voice-prompt");
          if (prompt) prompt.textContent = message;
        }
      },
      onError: () => {
        if (serial !== voiceStartSerial) return;
        state.voiceError = t("voice.unavailable");
        state.voiceStatus = "idle";
        voiceSession = null;
        voiceSessionToken = null;
        render();
      },
      onDisconnect: () => {
        if (serial !== voiceStartSerial) return;
        state.voiceStatus = "idle";
        voiceSession = null;
        finishVoiceSession(signed.voiceSessionToken);
        render();
      },
    });
    if (serial !== voiceStartSerial) {
      await session.endSession().catch(() => {});
      return;
    }
    voiceSession = session;
    state.voiceStatus = "listening";
  } catch (error) {
    if (serial !== voiceStartSerial) return;
    state.voiceError =
      error instanceof WorkerApiError
        ? formatError(error).message
        : t("voice.unavailable");
    state.voiceStatus = "idle";
    voiceSession = null;
    voiceSessionToken = null;
  } finally {
    render();
  }
}

async function stopVoice(): Promise<void> {
  voiceStartSerial++;
  const session = voiceSession;
  const token = voiceSessionToken;
  voiceSession = null;
  state.voiceStatus = "idle";
  if (session) await session.endSession().catch(() => {});
  if (token) finishVoiceSession(token);
  render();
}

function finishVoiceSession(token: string): void {
  if (voiceSessionToken !== token) return;
  voiceSessionToken = null;
  void resolveVoiceSession(token, voiceSessionTarget);
}

async function resolveVoiceSession(token: string, target: "feedback" | ChatMode): Promise<void> {
  state.voicePrompt = t("voice.checking");
  if (target !== "feedback") state.notice = state.voicePrompt;
  render();
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const outcome = await api.getVoiceSessionStatus(token);
      if (outcome.status === "pending") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      if (outcome.status === "submitted" && outcome.submissionId && outcome.receiptToken) {
        const credentials = { submissionId: outcome.submissionId, receiptToken: outcome.receiptToken };
        const receipt = await api.getReceipt(credentials);
        state.receiptCredentials = credentials;
        state.receipt = receipt.submission;
        storeReceiptCredentials(credentials);
        state.feedbackReviewing = false;
        state.showFeedbackForm = false;
        state.feedbackDraft = "";
        state.feedbackImprovement = "";
        state.page = "feedback";
        state.notice = t("voice.submitted");
      } else if (outcome.status === "duplicate") {
        state.voicePrompt = t("voice.duplicate");
        if (target === "feedback") state.page = "feedback";
      } else {
        state.voicePrompt = t("voice.notSubmitted");
      }
      if (target !== "feedback" && outcome.status !== "submitted") state.notice = state.voicePrompt;
      render();
      return;
    }
    state.voicePrompt = t("voice.notConfirmed");
  } catch {
    state.voicePrompt = t("voice.notConfirmed");
  }
  if (target !== "feedback") state.notice = state.voicePrompt;
  render();
}

function feedbackReview(): HTMLElement {
  const review = el("div", "review-sheet feedback-review");
  review.append(
    el("h3", "review-title", t("feedback.reviewTitle")),
    labeledValue(t("feedback.originalMessage"), state.feedbackDraft),
  );
  if (state.feedbackImprovement.trim()) {
    review.append(
      labeledValue(t("feedback.improvementLabel"), state.feedbackImprovement),
    );
  }
  if (state.feedbackDuplicate) {
    const match = el("section", "feedback-duplicate");
    match.append(
      el("h4", "", t("feedback.duplicateTitle")),
      el("p", "", t("feedback.duplicateExplanation")),
      el("div", "feedback-duplicate-status",
        el("span", "", t("feedback.duplicateStatus")),
        statusPill(state.feedbackDuplicate.status),
      ),
    );
    const separate = el("label", "checkbox-row");
    const confirm = el("input") as HTMLInputElement;
    confirm.type = "checkbox";
    confirm.checked = state.feedbackDuplicateOverride;
    confirm.addEventListener("change", () => {
      state.feedbackDuplicateOverride = confirm.checked;
      updateSend();
    });
    separate.append(confirm, el("span", "", t("feedback.separateIssue")));
    match.append(separate);
    review.append(match);
  }
  const acknowledgment = el("label", "checkbox-row");
  const checkbox = el("input") as HTMLInputElement;
  checkbox.type = "checkbox";
  checkbox.checked = state.sandboxAcknowledged;
  checkbox.addEventListener("change", () => {
    state.sandboxAcknowledged = checkbox.checked;
    updateSend();
  });
  acknowledgment.append(
    checkbox,
    el("span", "", t("feedback.sandboxAcknowledgement")),
  );
  review.append(acknowledgment);
  const actions = el("div", "form-actions split-actions");
  actions.append(
    button(t("feedback.edit"), "button-quiet", () => {
      state.feedbackReviewing = false;
      state.error = null;
      render();
    }),
  );
  const send = button(
    t(state.feedbackDuplicate ? "feedback.submitSeparate" : "feedback.sendToSample"),
    "button-primary",
    () => void submitFeedback(),
  );
  send.dataset.sendFeedback = "true";
  function updateSend(): void {
    send.disabled = !state.sandboxAcknowledged || state.pending === "feedback" ||
      Boolean(state.feedbackDuplicate && !state.feedbackDuplicateOverride);
  }
  updateSend();
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
    el(
      "div",
      "",
      el("h3", "receipt-title", t("feedback.receiptTitle")),
      el("p", "receipt-id", receipt.id),
    ),
    statusPill(receipt.status),
  );
  panel.append(
    titleRow,
    el("p", "privacy-line", t("feedback.receiptSecretHelp")),
  );
  if (state.receiptError) {
    panel.append(alertBox(state.receiptError, ""));
    panel.append(
      button(t("common.refresh"), "button-quiet", () => void refreshReceipt()),
    );
  }
  const thread = el("div", "message-thread");
  for (const message of receipt.messages) {
    const item = el(
      "article",
      `message-item ${message.author === "resident" ? "from-resident" : "from-staff"}`,
    );
    item.append(
      el(
        "div",
        "message-meta",
        message.author === "staff"
          ? t("feedback.staffReply")
          : t("feedback.originalMessage"),
      ),
      el("p", "message-body", message.body),
    );
    thread.append(item);
  }
  panel.append(thread);
  if (state.receiptCredentials && receipt.status !== "closed") {
    const reply = el("form", "reply-form");
    const input = textArea(
      "resident-follow-up",
      t("feedback.followUpLabel"),
      t("feedback.replyPlaceholder"),
      "",
      () => {},
      2,
    );
    const send = button(
      t("feedback.replySend"),
      "button-secondary",
      () =>
        void submitResidentFollowUp(
          input.querySelector("textarea")?.value ?? "",
        ),
    );
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
  if (state.postingsLoading) {
    main.append(loadingState());
  } else if (state.postingsError) {
    main.append(alertBox(state.postingsError, ""));
    main.append(
      button(t("common.retry"), "button-quiet", () => void loadPostings()),
    );
  } else if (state.postings.length === 0) {
    main.append(emptyState(t("application.loadError")));
  } else {
    const posting =
      state.postings.find((item) => item.id === state.selectedPostingId) ??
      state.postings[0]!;
    const summary = el("article", "posting-summary");
    summary.append(
      el("span", "sample-tag", t("application.practicePosting")),
      el("h2", "posting-title", posting.title),
      el("p", "posting-org", posting.organizationName),
      el("p", "", posting.description),
      el("span", "quiet-note", t("application.sampleGeography")),
    );
    main.append(summary, applicationForm(posting.id));
  }

  const aside = el("aside", "surface context-surface");
  aside.append(el("h2", "aside-title", t("application.status")));
  if (!currentToken()) {
    aside.append(el("p", "", t("auth.signInRequired")));
  } else if (state.applicationListLoading) {
    aside.append(loadingState());
  } else if (state.applicationListLoadedFor !== currentToken()) {
    aside.append(
      button(
        t("common.refresh"),
        "button-secondary",
        () => void loadMyApplications(),
      ),
    );
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
    const submit = form.querySelector<HTMLButtonElement>(
      "[data-submit-application]",
    );
    if (submit)
      submit.disabled = !checkbox.checked || state.pending === "application";
  });
  confirm.append(
    checkbox,
    el("span", "", t("application.applicantConfirmation")),
  );
  form.append(confirm);
  const actions = el("div", "form-actions");
  const submit = button(
    t("application.apply"),
    "button-primary",
    () => void submitApplication(postingId),
  );
  submit.dataset.submitApplication = "true";
  submit.disabled =
    !state.applicationConfirmed || state.pending === "application";
  if (state.pending === "application") submit.prepend(spinner());
  actions.append(submit);
  form.append(actions);
  form.addEventListener("submit", (event) => event.preventDefault());
  return form;
}

function employeePage(): HTMLElement {
  const main = el("section", "employee-content");
  const auth = webAuth.snapshot();
  if (!currentToken() || (auth.status === "authenticated" && auth.mode !== "employee")) {
    main.append(signInPrompt());
    return main;
  }
  if (state.employeePage === "assistant") {
    main.append(chatPage("employee"));
  } else if (!staffSummary) {
    if (staffSummaryError) main.append(
      alertBox(staffSummaryError, ""),
      button(t("common.refresh"), "button-secondary", () => {
        staffSummaryFor = "";
        staffSummaryError = "";
        render();
      }),
    );
    else main.append(loadingState());
  } else if (state.staffView === "issues" && !staffSummary.capabilities.feedbackRead) {
    main.append(alertBox(state.locale === "fr" ? "Accès indisponible pour ce compte." : "This account cannot open this workspace.", ""));
  } else if (state.selectedFeedbackId) {
    main.append(button(t("feedback.backToInbox"), "button-quiet", () => {
      state.selectedFeedbackId = "";
      state.selectedFeedback = null;
      render();
    }));
    if (state.selectedFeedbackLoading) main.append(loadingState());
    else if (state.selectedFeedbackError) main.append(alertBox(state.selectedFeedbackError, ""));
    else if (state.selectedFeedback) main.append(feedbackCaseDetail(state.selectedFeedback, "staff"));
  } else if (state.staffView === "issues") {
    if (state.employeeLoading) main.append(loadingState());
    else if (state.feedbackQueueLoadedFor !== currentToken()) {
      main.append(button(t("common.refresh"), "button-secondary", () => void loadEmployeeQueue()));
    } else if (state.feedbackQueue.length === 0) main.append(emptyState(t("feedback.noFeedback")));
    else main.append(feedbackQueueList());
  } else {
    main.append(staffWorkspace({
      view: state.staffView,
      token: currentToken(),
      organizationId: currentOrgId(),
      locale: state.locale,
      summary: staffSummary,
      onOpenFeedback: (id) => {
        state.selectedFeedbackId = id;
        state.selectedFeedback = null;
        void refreshStaffCase(id);
      },
    }));
  }
  return main;
}

function employeeNavButton(
  page: EmployeePage,
  key: MessageKey,
): HTMLButtonElement {
  const button = el(
    "button",
    `employee-nav ${state.employeePage === page ? "is-selected" : ""}`,
  ) as HTMLButtonElement;
  button.type = "button";
  button.textContent = t(key);
  button.addEventListener("click", () => {
    state.employeePage = page;
    state.error = null;
    render();
    if (currentToken() && page !== "assistant") void loadEmployeeQueue();
    if (currentToken() && page === "assistant") void restoreChat("employee");
  });
  return button;
}

function feedbackQueueList(): HTMLElement {
  const wrapper = el("div", "case-list");
  const bar = el("div", "case-list-toolbar");
  bar.append(
    el("h2", "", t("sidebar.inbox")),
    button(t("common.refresh"), "button-quiet", () => void loadEmployeeQueue()),
  );
  wrapper.append(bar);
  for (const item of state.feedbackQueue) {
    const row = button(item.originalText, "case-list-row", () => {
      state.selectedFeedbackId = item.id;
      state.selectedFeedback = null;
      void refreshStaffCase(item.id);
    });
    row.replaceChildren(
      el("span", "case-list-copy",
        el("strong", "", item.originalText),
        el("small", "", item.departmentName ?? t("feedback.department")),
      ),
      statusPill(item.status),
      el("time", "", formatDate(item.createdAt)),
    );
    wrapper.append(row);
  }
  return wrapper;
}

function applicationQueueList(): HTMLElement {
  const wrapper = el("div", "queue-list");
  wrapper.append(
    button(t("common.refresh"), "button-quiet", () => void loadEmployeeQueue()),
  );
  for (const item of state.applicationQueue) {
    const row = el("article", "queue-entry application-entry");
    row.append(
      el(
        "div",
        "queue-entry-head",
        el("strong", "", item.postingTitle ?? item.postingId),
        statusPill(item.status),
      ),
      el(
        "span",
        "quiet-note",
        `${t("application.answers")}: ${item.applicantSubject ?? ""}`,
      ),
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
    const update = button(
      t("application.saveStatus"),
      "button-secondary",
      () => {
        void withPending(`application-status-${item.id}`, async () => {
          await api.changeApplicationStatus(
            currentToken()!,
            currentOrgId(),
            item.id,
            next.value as ApplicationStatus,
          );
          await loadEmployeeQueue();
        });
      },
    );
    update.disabled = state.pending === `application-status-${item.id}`;
    row.append(el("div", "form-actions staff-actions", next, update));
    wrapper.append(row);
  }
  return wrapper;
}

function signInPrompt(): HTMLElement {
  const prompt = el("div", "sign-in-prompt");
  prompt.append(el("p", "", t("auth.signInRequired")));
  const auth = webAuth.snapshot();
  if (auth.status === "guest" || (state.page === "employee" && auth.status === "authenticated" && auth.mode !== "employee")) {
    prompt.append(button(t(state.page === "employee" ? "auth.staffSignIn" : "auth.signIn"), "button-primary", () => {
      openSignIn(state.page === "employee" ? "staff" : "profile");
    }));
  }
  if (webAuth.snapshot().error) prompt.append(alertBox(webAuth.snapshot().error!, ""));
  return prompt;
}

function labeledValue(label: string, value: string): HTMLElement {
  return el(
    "div",
    "labeled-value",
    el("span", "field-caption", label),
    el("p", "", value),
  );
}

function textArea(
  id: string,
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
  rows = 5,
): HTMLElement {
  const area = el("textarea", "textarea") as HTMLTextAreaElement;
  area.id = id;
  area.name = id;
  area.rows = rows;
  area.placeholder = placeholder;
  area.value = value;
  area.addEventListener("input", () => onInput(area.value));
  return uiField(label, area, { className: "field", captionClassName: "field-caption" });
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
    for (const status of values)
      select.append(option(status, statusName(status), selected));
  }
  return select;
}

function statusPill(status: string): HTMLElement {
  return uiStatus(statusName(status), { className: `status-pill status-${status}` });
}

function option(
  value: string,
  label: string,
  selected: string,
): HTMLOptionElement {
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
  const variant = className.match(/(?:^|\s)button-(primary|secondary|quiet|link)(?:\s|$)/)?.[1] as ButtonVariant | undefined;
  if (variant && label) return uiButton(label, action, { variant, className });
  const result = el("button", className, label) as HTMLButtonElement;
  result.type = "button";
  result.addEventListener("click", action);
  return result;
}

function loadingState(): HTMLElement {
  return el(
    "div",
    "loading-state",
    spinner(),
    el("span", "", t("common.loading")),
  );
}

function spinner(): HTMLElement {
  const result = el("span", "spinner");
  result.setAttribute("aria-hidden", "true");
  return result;
}

function emptyState(message: string): HTMLElement {
  return el(
    "div",
    "empty-state",
    el("span", "empty-mark", "—"),
    el("p", "", message),
  );
}

function alertBox(
  message: string,
  requestId: string,
  kind = "error",
): HTMLElement {
  const alert = el("div", `inline-alert ${kind}`);
  alert.setAttribute("role", kind === "error" ? "alert" : "status");
  alert.append(el("p", "", message));
  if (requestId)
    alert.append(el("small", "request-id", `Request ${requestId}`));
  return alert;
}

function iconNode(kind: string): HTMLElement {
  const icons: Record<string, string> = {
    activity: Activity, "arrow-up": ArrowUp, briefcase: BriefcaseBusiness,
    building: Building2, chart: ChartNoAxesColumn, "chevron-down": ChevronDown,
    "chevron-right": ChevronRight,
    chat: MessageSquare, feedback: FileText,
    files: BookOpen, inbox: Inbox, login: LogIn, logout: LogOut,
    map: MapPin, menu: Menu, mic: Mic, panel: PanelLeftClose,
    plus: Plus, plugins: Blocks, search: Search, tags: Tags,
    taxonomy: ListTree, user: UserRound, users: Users,
    bookmark: Bookmark, clipboard: ClipboardList, funding: Coins,
    support: HeartHandshake, landmark: Landmark, participation: MessagesSquare,
    dashboard: LayoutDashboard, check: Check,
  };
  const wrapper = el("span", "nav-icon");
  wrapper.innerHTML = icons[kind] ?? Activity;
  return wrapper;
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
  if (state.page === "assistant") return t("nav.assistant");
  if (state.page === "signin") return t("auth.signIn");
  if (state.page === "feedback") return t("feedback.title");
  if (state.page === "applications") return t(state.applicationView === "browse" ? "application.findRole" : "sidebar.myApplications");
  if (state.page === "discovery") return t(`sidebar.${state.discoveryArea === "all" ? "explore" : state.discoveryArea}` as MessageKey);
  if (state.page === "programs") return t(state.programView === "discover" ? "sidebar.programs" : state.programView === "mine" ? "sidebar.programRequests" : "sidebar.programSponsor");
  if (state.page === "external-preparation") return t("sidebar.externalPreparation");
  if (state.page === "profile") return t("sidebar.profile");
  return t("nav.employee");
}

function currentToken(): string {
  return webAuth.snapshot().accessToken ?? state.localIdentity;
}

function currentOrgId(): string {
  return webAuth.snapshot().organizationId ?? "org_43G1B1RhPwac7EjS";
}

async function ensureStaffSummary(): Promise<void> {
  const token = currentToken();
  if (!token) return;
  const organizationId = currentOrgId();
  const identity = `${token}:${organizationId}`;
  if (staffSummaryFor === identity) return;
  staffSummaryFor = identity;
  staffSummary = null;
  staffSummaryError = "";
  try {
    const summary = await loadStaffWorkspaceSummary(token, organizationId);
    if (staffSummaryFor !== identity) return;
    staffSummary = summary;
    if (!staffViewIsAllowed(state.staffView, summary)) {
      state.staffView = firstStaffView(summary);
      state.selectedFeedbackId = "";
      state.selectedFeedback = null;
    }
  } catch (error) {
    if (staffSummaryFor !== identity) return;
    const status = error instanceof Error && "status" in error ? error.status : null;
    staffSummaryError = status === 401
      ? (state.locale === "fr" ? "Connectez-vous pour continuer." : "Sign in to continue.")
      : status === 403
        ? (state.locale === "fr" ? "Ce compte n’a pas accès à cet espace." : "This account cannot access this workspace.")
        : error instanceof Error ? error.message : (state.locale === "fr" ? "Espace indisponible." : "Workspace unavailable.");
  }
  if (state.page === "employee") render();
}

function staffViewIsAllowed(view: StaffView, summary: StaffWorkspaceSummary): boolean {
  return view === "issues" ? summary.capabilities.feedbackRead : viewAllowed(view, summary.capabilities);
}

function firstStaffView(summary: StaffWorkspaceSummary): StaffView {
  return (["overview", "hiring", "applicants", "taxonomy", "audit"] as const).find((view) => viewAllowed(view, summary.capabilities)) ?? "overview";
}

function t(
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
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
    SANDBOX_ACK_REQUIRED: "error.sandboxAcknowledgement",
    ABUSE_CONTROL_UNAVAILABLE: "error.abuseUnavailable",
    RATE_LIMITED: "error.rateLimited",
    INVALID_EVIDENCE: "error.invalidEvidence",
    AI_UNAVAILABLE: "assistant.unavailable",
    PROPOSAL_EXPIRED: "assistant.sessionExpired",
    STALE_PROPOSAL: "error.invalidTransition",
    FEEDBACK_UNAVAILABLE: "error.abuseUnavailable",
    DUPLICATE_CHECK_UNAVAILABLE: "error.duplicateCheckUnavailable",
    VOICE_UNAVAILABLE: "voice.unavailable",
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
    if (
      !state.postings.some((posting) => posting.id === state.selectedPostingId)
    ) {
      state.selectedPostingId = state.postings[0]?.id ?? "";
    }
  } catch (error) {
    state.postingsError = formatError(error).message;
  } finally {
    state.postingsLoading = false;
    if (state.page === "applications") render();
  }
}

async function checkFeedbackBeforeReview(): Promise<void> {
  if (state.voiceStatus !== "idle") await stopVoice();
  const message = state.feedbackDraft.trim();
  if (!message) {
    state.error = { message: t("error.invalidRequest"), requestId: "" };
    render();
    return;
  }
  state.pending = "feedback-check";
  state.error = null;
  render();
  try {
    const result = await api.checkFeedbackDuplicate(message, "3520005");
    if (state.feedbackDraft.trim() !== message) return;
    state.feedbackDuplicate = result.duplicate;
    state.feedbackDuplicateOverride = false;
    state.sandboxAcknowledged = false;
    state.feedbackReviewing = true;
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.pending = "";
    render();
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
      state.feedbackDuplicateOverride,
    );
    if ("duplicate" in response && response.duplicate) {
      state.feedbackDuplicate = response.duplicate;
      state.feedbackDuplicateOverride = false;
      state.sandboxAcknowledged = false;
      state.feedbackReviewing = true;
      return;
    }
    if (!("submission" in response) || !("receiptToken" in response))
      throw new Error("Invalid feedback response");
    state.receiptCredentials = {
      submissionId: response.submission.id,
      receiptToken: response.receiptToken,
    };
    state.receipt = response.submission;
    storeReceiptCredentials(state.receiptCredentials);
    state.feedbackReviewing = false;
    state.feedbackDuplicate = null;
    state.feedbackDuplicateOverride = false;
    state.showFeedbackForm = false;
    state.feedbackDraft = "";
    state.feedbackImprovement = "";
    state.sandboxAcknowledged = false;
    state.notice = t("feedback.submitted", {
      receiptId: response.submission.id,
    });
    await refreshReceipt(false);
  } catch (error) {
    state.error = formatError(error);
  } finally {
    state.pending = "";
    render();
  }
}

async function showEmergencyGuidance(): Promise<void> {
  state.pending = "emergency";
  state.error = null;
  render();
  try {
    const response = await api.getEmergencyGuidance(state.locale);
    state.emergencyMessage = response.emergencyRedirect.message;
  } catch (error) {
    state.error = formatError(error);
    state.emergencyMessage = t("feedback.emergencyNote");
  } finally {
    state.pending = "";
    render();
  }
}

async function refreshReceipt(showPending = true): Promise<void> {
  if (!state.receiptCredentials) return;
  if (showPending) {
    state.pending = "receipt";
    render();
  }
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

async function reopenResidentCase(message: string): Promise<void> {
  if (!state.receiptCredentials || !message.trim()) return;
  state.pending = "resident-reopen";
  state.error = null;
  state.receiptError = "";
  render();
  try {
    state.receipt = await reopenResidentFeedback(state.receiptCredentials, message);
  } catch (error) {
    state.receiptError = error instanceof Error ? error.message : t("error.generic");
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
  if (
    !state.applicationExperience.trim() ||
    !state.applicationAvailability.trim()
  ) {
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
      organization:
        state.postings.find((posting) => posting.id === postingId)
          ?.organizationName ?? t("feedback.sandboxBadge"),
    });
    state.applicationListLoadedFor = "";
    state.applicationConfirmed = false;
    await loadMyApplications();
    if (
      !state.applicantApplications.some(
        (application) => application.id === response.application.id,
      )
    ) {
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
      const response = await api.getStaffFeedback(
        token,
        currentOrgId(),
      );
      state.feedbackQueue = response.submissions;
      state.feedbackQueueLoadedFor = token;
    } else {
      const response = await api.getStaffApplications(
        token,
        currentOrgId(),
      );
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

async function withPending(
  key: string,
  operation: () => Promise<void>,
): Promise<void> {
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
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
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
