import {
  type ApplicationStatus,
  type FeedbackStatus,
  type Locale,
} from "@civicresolve/contracts/v1";
import { tokens } from "@civicresolve/design-tokens";
import { translate, type MessageKey } from "@civicresolve/i18n";
import { createDiscoveryPage, type DiscoveryArea } from "../features/discovery/index.js";
import { createProfilePage } from "../features/profile/index.js";
import { staffWorkspace } from "../features/staff/index.js";
import { webAuth } from "./auth0.js";
import {
  Activity, ArrowUp, Blocks, BriefcaseBusiness, ChartNoAxesColumn,
  ChevronDown, ChevronRight, FileText, Inbox, ListTree, LogIn, LogOut,
  MapPin, Menu, MessageSquare, Mic, PanelLeftClose, Plus, Search,
  Tags, UserRound, Users, Building2, BookOpen,
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
import "./styles.css";

type Page = "assistant" | "feedback" | "applications" | "employee" | "discovery" | "profile";
type EmployeePage = "assistant" | "feedback" | "applications";
type StaffView = "issues" | "overview" | "themes" | "taxonomy" | "hiring" | "applicants" | "analytics";
type ChatMode = "resident" | "employee";

interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
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
  tools: AgentTool[];
  tray: "area" | "files" | "plugins" | null;
  toolSearch: string;
  history: ChatHistoryEntry[];
  historyLoaded: boolean;
  contextArea: string | null;
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
    tools: [],
    tray: null,
    toolSearch: "",
    history: [],
    historyLoaded: false,
    contextArea: null,
  };
}

interface AppState {
  locale: Locale;
  page: Page;
  discoveryArea: DiscoveryArea;
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
  exploreOpen: boolean;
  historyOpen: boolean;
  historySearch: string;
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
  page: "assistant",
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
  exploreOpen: true,
  historyOpen: true,
  historySearch: "",
};

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root is missing.");
let voiceSession: { endSession(): Promise<void> } | null = null;
let voiceStartSerial = 0;
let lastAuthIdentity = "";

applyTokens();
render();
webAuth.subscribe((snapshot) => {
  const identity = snapshot.accessToken ?? "guest";
  if (identity !== lastAuthIdentity) {
    state.chats = { resident: newChatState(), employee: newChatState() };
    state.feedbackQueue = [];
    state.applicationQueue = [];
    state.applicantApplications = [];
    lastAuthIdentity = identity;
  }
  state.applicationListLoadedFor = "";
  state.feedbackQueueLoadedFor = "";
  state.applicationQueueLoadedFor = "";
  render();
  void loadRecent(activeChatMode());
});
void webAuth.initialize();
void loadRecent("resident");
void restoreChat("resident");
void loadPostings();
if (state.receiptCredentials) void refreshReceipt();

function render(): void {
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
  root!.append(shell);
}

function header(): HTMLElement {
  const header = el("header", "topbar");
  const menu = button(t("app.openMenu"), "mobile-menu-button", () => {
    state.sidebarOpen = true;
    render();
  });
  menu.setAttribute("aria-label", t("app.openMenu"));
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
  const head = el("div", "sidebar-head");
  const collapse = button(t("app.collapseMenu"), "sidebar-collapse", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    render();
  });
  collapse.replaceChildren(iconNode("panel"));
  collapse.setAttribute("aria-label", t("app.collapseMenu"));
  head.append(brand(), collapse);
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
  const search = el("input", "sidebar-search") as HTMLInputElement;
  search.type = "search";
  search.placeholder = t("assistant.searchChats");
  search.setAttribute("aria-label", t("assistant.searchChats"));
  search.value = state.historySearch;
  search.addEventListener("input", () => {
    state.historySearch = search.value;
    for (const item of sidebar.querySelectorAll<HTMLElement>("[data-history-label]")) {
      item.hidden = !item.dataset.historyLabel?.includes(search.value.toLowerCase());
    }
  });
  tools.append(search);
  sidebar.append(tools);

  const nav = el("nav", "primary-nav");
  nav.setAttribute("aria-label", t("app.name"));
  if (state.page === "employee") {
    nav.append(
      sidebarHeading(t("sidebar.workspace")),
      staffViewAction("issues", "inbox", "sidebar.inbox"),
      staffSidebarAction("assistant", "chat", "nav.assistant"),
      staffViewAction("overview", "activity", "sidebar.overview"),
      staffViewAction("themes", "tags", "sidebar.themes"),
      staffViewAction("hiring", "briefcase", "sidebar.hiring"),
      staffViewAction("applicants", "users", "sidebar.applicants"),
      staffViewAction("analytics", "chart", "sidebar.analytics"),
      sidebarAction("files", t("sidebar.sources"), () => void openPluginTool("employee", "list_sources")),
      staffViewAction("taxonomy", "taxonomy", "sidebar.taxonomy"),
    );
  } else {
    nav.append(
      sidebarHeading(t("sidebar.myActivity")),
      navButton("applications", "sidebar.myApplications", "briefcase"),
      navButton("profile", "sidebar.profile", "user"),
      discoveryButton("saved", "sidebar.saved"),
    );
    if (state.receiptCredentials) nav.append(navButton("feedback", "sidebar.myFeedback", "feedback"));
    nav.append(
      sidebarHeading(t("sidebar.agent")),
      navButton("assistant", "nav.assistant", "chat"),
    );
    const explore = sidebarAction(state.exploreOpen ? "chevron-down" : "chevron-right", t("sidebar.explore"), () => {
      state.exploreOpen = !state.exploreOpen;
      render();
    });
    explore.setAttribute("aria-expanded", String(state.exploreOpen));
    nav.append(explore);
    if (state.exploreOpen) {
      const nested = el("div", "sidebar-nested");
      nested.append(
        discoveryButton("jobs", "sidebar.jobs"),
        discoveryButton("support", "sidebar.support"),
        discoveryButton("funding", "sidebar.funding"),
        discoveryButton("nearby", "sidebar.nearby"),
        discoveryButton("participation", "sidebar.participation"),
        navButton("feedback", "nav.feedback", "feedback"),
      );
      nav.append(nested);
    }
  }
  nav.append(sidebarAction("plugins", t("sidebar.plugins"), () => void openChatTray(activeChatMode(), "plugins")));
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
  } else if (auth.status === "guest" || auth.status === "unconfigured") {
    if (auth.status === "guest") footer.append(sidebarAction("login", t("auth.signIn"), () => void webAuth.login("applicant")));
  }
  const identity = devIdentityPanel();
  if (identity) footer.append(identity);
  if (state.page === "employee") footer.append(navButton("assistant", "sidebar.residentView", "chat"));
  else footer.append(navButton("employee", "sidebar.staffView", "building"));
  sidebar.append(footer);
  return sidebar;
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

function staffViewAction(view: StaffView, icon: string, key: MessageKey): HTMLButtonElement {
  const result = sidebarAction(icon, t(key), () => {
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
  const result = sidebarAction("map", t(labelKey), () => {
    state.page = "discovery";
    state.discoveryArea = area;
    state.sidebarOpen = false;
    render();
  });
  if (state.page === "discovery" && state.discoveryArea === area) result.classList.add("is-active");
  return result;
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
  else if (state.page === "feedback") main.append(feedbackPage());
  else if (state.page === "applications") main.append(applicationsPage());
  else if (state.page === "discovery") main.append(createDiscoveryPage({ area: state.discoveryArea, locale: state.locale, token: currentToken() || null }));
  else if (state.page === "profile") main.append(createProfilePage({ locale: state.locale, token: currentToken() || null }));
  else main.append(employeePage());
  return main;
}

function chatPage(mode: ChatMode): HTMLElement {
  const chat = state.chats[mode];
  const page = el("section", `chat-shell ${chat.messages.length ? "has-messages" : "is-empty"}`);

  const thread = el("div", "chat-thread");
  thread.setAttribute("aria-live", "polite");
  if (chat.messages.length === 0) {
    const welcome = el("div", "chat-welcome");
    welcome.append(el("h2", "", t("assistant.welcome")));
    thread.append(welcome);
  }
  for (const message of chat.messages) {
    if (message.role === "tool") {
      const details = el("details", "chat-tool-result");
      details.append(
        el("summary", "", t("assistant.toolResult")),
        el("pre", "", message.content),
      );
      thread.append(details);
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
  for (const proposal of chat.proposals.filter(
    (item) => item.status === "pending",
  )) {
    thread.append(proposalCard(mode, proposal));
  }
  if (chat.pending) thread.append(loadingState());
  page.append(thread);

  if (chat.error) page.append(alertBox(chat.error, ""));
  const composeArea = el("div", "chat-compose-area");
  const composer = el("form", "chat-composer");
  const input = el("textarea", "chat-input") as HTMLTextAreaElement;
  input.rows = 3;
  input.maxLength = 4000;
  input.placeholder = t("assistant.placeholder");
  input.setAttribute("aria-label", t("assistant.placeholder"));
  input.value = chat.draft;
  input.addEventListener("input", () => (chat.draft = input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendChat(mode);
    }
  });
  const controls = el("div", "chat-composer-controls");
  const add = button("", "chat-round-button chat-add-button", () => void openChatTray(mode, chat.tray ? null : "files"));
  add.append(iconNode("plus"));
  add.setAttribute("aria-label", t("assistant.files"));
  const model = el("span", "chat-model", t("assistant.model"));
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
  controls.append(add, model, mic, send);
  composer.append(input, controls);
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendChat(mode);
  });
  composeArea.append(composer);
  const shortcuts = el("div", "chat-shortcuts");
  shortcuts.append(
    button(t("assistant.chooseArea"), "chat-shortcut", () => void openChatTray(mode, "area")),
    button(t("assistant.files"), "chat-shortcut", () => void openChatTray(mode, "files")),
    button(t("assistant.plugins"), "chat-shortcut", () => void openChatTray(mode, "plugins")),
  );
  composeArea.append(shortcuts);
  if (chat.contextArea) composeArea.append(el("span", "chat-context-area", chat.contextArea));
  if (chat.tray) composeArea.append(chatTray(mode));
  if (state.voiceError) composeArea.append(el("p", "voice-error", state.voiceError));
  if (state.voicePrompt && state.voiceStatus !== "idle") composeArea.append(el("p", "voice-prompt", state.voicePrompt));
  page.append(composeArea);
  return page;
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
    if (!currentToken()) tray.append(el("p", "chat-tray-note", t("assistant.filesSignIn")));
    else {
      const label = el("label", "chat-file-label", t("assistant.uploadResume"));
      const file = el("input") as HTMLInputElement;
      file.type = "file";
      file.accept = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      file.addEventListener("change", () => {
        const selected = file.files?.[0];
        if (selected) void uploadChatResume(mode, selected);
      });
      label.append(file);
      tray.append(label);
    }
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

async function uploadChatResume(mode: ChatMode, file: File): Promise<void> {
  const chat = state.chats[mode];
  const token = currentToken();
  if (!token || chat.pending) return;
  chat.pending = true;
  chat.error = "";
  render();
  try {
    const response = await api.uploadResume(token, file);
    chat.messages.push({ role: "tool", content: `${t("assistant.uploadResume")}: ${response.resume.filename}` });
    chat.tray = null;
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
  }
}

function proposalCard(mode: ChatMode, proposal: AgentProposal): HTMLElement {
  const card = el("section", "proposal-card");
  card.append(
    el("h3", "", t("assistant.reviewAction")),
    el(
      "p",
      "proposal-target",
      `${proposal.preview.method ?? ""} ${proposal.preview.path ?? ""}`.trim(),
    ),
  );
  if (proposal.preview.body && typeof proposal.preview.body === "object") {
    const body = el("div", "proposal-fields");
    for (const [key, value] of Object.entries(proposal.preview.body)) {
      body.append(
        labeledValue(
          key,
          typeof value === "string" ? value : String(JSON.stringify(value)),
        ),
      );
    }
    card.append(body);
  }
  if (proposal.preview.destinationNotice) {
    card.append(el("p", "proposal-notice", proposal.preview.destinationNotice));
  }
  const isFeedback = proposal.preview.name === "create_feedback";
  if (isFeedback) {
    const acknowledgment = el("label", "checkbox-row proposal-ack");
    const check = el("input") as HTMLInputElement;
    check.type = "checkbox";
    check.checked = state.chats[mode].approvalChecked[proposal.id] === true;
    check.addEventListener("change", () => {
      state.chats[mode].approvalChecked[proposal.id] = check.checked;
      const approve = card.querySelector<HTMLButtonElement>(
        "[data-proposal-approve]",
      );
      if (approve)
        approve.disabled = !check.checked || state.chats[mode].pending;
    });
    acknowledgment.append(
      check,
      el("span", "", t("feedback.sandboxAcknowledgement")),
    );
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
  approve.disabled =
    state.chats[mode].pending ||
    (isFeedback && !state.chats[mode].approvalChecked[proposal.id]);
  decline.disabled = state.chats[mode].pending;
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
  state.sidebarOpen = false;
  render();
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
  "list_staff_applications", "read_taxonomy", "list_taxonomy_versions",
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
      chat.messages.push({ role: "tool", content: visibleToolResult(response.result) });
    }
    if (response.proposal) chat.proposals.push(response.proposal);
  } catch (error) {
    chat.error = formatError(error).message;
  } finally {
    chat.pending = false;
    render();
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
    if (response.toolResult !== undefined) {
      chat.messages.push({
        role: "tool",
        content: visibleToolResult(response.toolResult),
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
  }
}

async function decideProposal(
  mode: ChatMode,
  proposal: AgentProposal,
  approved: boolean,
): Promise<void> {
  const chat = state.chats[mode];
  if (!chat.id || chat.pending) return;
  const sandboxAcknowledged =
    proposal.preview.name === "create_feedback" &&
    chat.approvalChecked[proposal.id] === true;
  if (
    approved &&
    proposal.preview.name === "create_feedback" &&
    !sandboxAcknowledged
  )
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
    );
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
      });
    }
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
    const detail = feedbackCaseDetail(state.receipt, "resident");
    detail.append(button(t("feedback.newReport"), "button-quiet", () => {
      state.showFeedbackForm = true;
      render();
    }));
    return detail;
  }
  const layout = el("div", "two-column");
  const left = el("section", "surface primary-surface");
  if (state.receipt && !state.showFeedbackForm) {
    left.append(
      receiptPanel(),
      button(t("feedback.newReport"), "button-quiet", () => {
        state.showFeedbackForm = true;
        render();
      }),
    );
  } else {
    if (state.feedbackReviewing) left.append(feedbackReview());
    else left.append(feedbackForm());
    if (state.receipt) left.append(receiptPanel());
  }

  const aside = el("aside", "surface context-surface");
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
  const status = selectStatuses(nextFeedbackStatuses(receipt.status), receipt.status, "feedback.nextStatus");
  const outcome = textArea(`staff-detail-outcome-${receipt.id}`, t("feedback.outcomeLabel"), t("feedback.outcomeLabel"), "", () => {}, 2);
  outcome.hidden = status.value !== "outcome_recorded";
  status.addEventListener("change", () => { outcome.hidden = status.value !== "outcome_recorded"; });
  const update = button(t("feedback.updateStatus"), "button-secondary", () => {
    const outcomeText = outcome.querySelector("textarea")?.value.trim() ?? "";
    if (status.value === "outcome_recorded" && !outcomeText) {
      state.error = { message: t("feedback.outcomeRequired"), requestId: "" };
      render();
      return;
    }
    void withPending(`detail-status-${receipt.id}`, async () => {
      await api.changeFeedbackStatus(currentToken(), currentOrgId(), receipt.id, status.value as FeedbackStatus, outcomeText);
      await refreshStaffCase(receipt.id);
      await loadEmployeeQueue();
    });
  });
  update.disabled = state.pending === `detail-status-${receipt.id}`;
  actions.append(status, outcome, update);
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
  const form = el("form", "form-stack");
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
  form.append(voice);
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
  const review = button(t("feedback.review"), "button-primary", async () => {
    if (state.voiceStatus !== "idle") await stopVoice();
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

async function startVoice(target: "feedback" | ChatMode = "feedback"): Promise<void> {
  if (state.voiceStatus !== "idle") return;
  const serial = ++voiceStartSerial;
  state.voiceStatus = "connecting";
  state.voiceError = "";
  render();
  try {
    const signed = await api.createVoiceSession(state.locale);
    if (serial !== voiceStartSerial) return;
    const { Conversation } = await import("@elevenlabs/client");
    if (serial !== voiceStartSerial) return;
    const session = await Conversation.startSession({
      signedUrl: signed.signedUrl,
      connectionType: "websocket",
      onMessage: ({ role, message }) => {
        if (serial !== voiceStartSerial) return;
        if (role === "user") {
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
        render();
      },
      onDisconnect: () => {
        if (serial !== voiceStartSerial) return;
        state.voiceStatus = "idle";
        voiceSession = null;
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
  } finally {
    render();
  }
}

async function stopVoice(): Promise<void> {
  voiceStartSerial++;
  const session = voiceSession;
  voiceSession = null;
  state.voiceStatus = "idle";
  if (session) await session.endSession().catch(() => {});
  render();
}

function feedbackReview(): HTMLElement {
  const review = el("div", "review-sheet");
  review.append(
    el("h3", "review-title", t("feedback.reviewTitle")),
    labeledValue(t("feedback.originalMessage"), state.feedbackDraft),
  );
  if (state.feedbackImprovement.trim()) {
    review.append(
      labeledValue(t("feedback.improvementLabel"), state.feedbackImprovement),
    );
  }
  const acknowledgment = el("label", "checkbox-row");
  const checkbox = el("input") as HTMLInputElement;
  checkbox.type = "checkbox";
  checkbox.checked = state.sandboxAcknowledged;
  checkbox.addEventListener("change", () => {
    state.sandboxAcknowledged = checkbox.checked;
    const send = review.querySelector<HTMLButtonElement>(
      "[data-send-feedback]",
    );
    if (send) send.disabled = !checkbox.checked || state.pending === "feedback";
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
    t("feedback.sendToSample"),
    "button-primary",
    () => void submitFeedback(),
  );
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
      void webAuth.login(state.page === "employee" ? "employee" : "applicant");
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
    for (const status of values)
      select.append(option(status, statusName(status), selected));
  }
  return select;
}

function statusPill(status: string): HTMLElement {
  return el("span", `status-pill status-${status}`, statusName(status));
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
    "chevron-right": ChevronRight, chat: MessageSquare, feedback: FileText,
    files: BookOpen, inbox: Inbox, login: LogIn, logout: LogOut,
    map: MapPin, menu: Menu, mic: Mic, panel: PanelLeftClose,
    plus: Plus, plugins: Blocks, search: Search, tags: Tags,
    taxonomy: ListTree, user: UserRound, users: Users,
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
  if (state.page === "feedback") return t("feedback.title");
  if (state.page === "applications") return t("application.title");
  if (state.page === "discovery") return t(`sidebar.${state.discoveryArea === "all" ? "explore" : state.discoveryArea}` as MessageKey);
  if (state.page === "profile") return t("sidebar.profile");
  return t("nav.employee");
}

function currentToken(): string {
  return webAuth.snapshot().accessToken ?? state.localIdentity;
}

function currentOrgId(): string {
  return webAuth.snapshot().organizationId ?? "org_43G1B1RhPwac7EjS";
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
  rootStyle.setProperty("--color-text", "#171717");
  rootStyle.setProperty("--color-muted", "#696969");
  rootStyle.setProperty("--color-surface", "#ffffff");
  rootStyle.setProperty("--color-canvas", "#ffffff");
  rootStyle.setProperty("--color-border", "#e6e6e6");
  rootStyle.setProperty("--color-accent", "#171717");
  rootStyle.setProperty("--color-accent-strong", "#171717");
  rootStyle.setProperty("--color-success", "#171717");
  rootStyle.setProperty("--color-warning", "#171717");
  rootStyle.setProperty("--color-danger", "#171717");
  rootStyle.setProperty("--color-focus", "#444444");
  rootStyle.setProperty("--font-body", tokens.typography.body);
}
