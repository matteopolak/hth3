import type {
  ApplicationStatus,
  FeedbackStatus,
  FeedbackReceiptView,
  FeedbackEmergencyResponse,
  Locale,
  PublicPostingView,
  ApplicantProfileView,
  ProfileResponse,
  ResumeView,
  ResumeExtractionResponse,
} from "@civicresolve/contracts/v1";

export interface ApplicationView {
  id: string;
  postingId: string;
  postingTitle: string;
  status: ApplicationStatus;
  sample: boolean;
  submittedAt: string;
  updatedAt: string;
  answers: Record<string, string>;
  applicantSubject?: string;
}

export interface StaffFeedbackView {
  id: string;
  originalText: string;
  status: FeedbackStatus;
  departmentName: string | null;
  outcome: string | null;
  sample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackClientReceipt extends FeedbackReceiptView {
  originalText: string;
  constructiveFollowUp: string | null;
  category: string;
  municipality: { id: string; name: string; province: string } | null;
  destinationLabel: string | null;
  evidence: Array<{
    id: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    downloadPath: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptCredentials {
  submissionId: string;
  receiptToken: string;
}

export interface FeedbackDuplicate {
  status: FeedbackStatus;
}

export type FeedbackSubmitResponse =
  | { submission: FeedbackClientReceipt; receiptToken: string }
  | { result: "duplicate"; created: false; duplicate: FeedbackDuplicate };

export interface ConversationCredentials {
  accessToken?: string;
  conversationToken?: string;
  receiptToken?: string;
}

export interface AgentProposal {
  id: string;
  status: "pending" | "approved" | "rejected";
  preview: {
    name?: string;
    method?: string;
    path?: string;
    body?: unknown;
    destinationNotice?: string;
    recordVersion?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
  expiresAt?: string;
}

export interface AgentConversation {
  id: string;
  mode: "resident" | "employee";
  locale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTool {
  name: string;
  access: "read" | "write";
  description: string;
}

export class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string,
  ) {
    super(message);
    this.name = "WorkerApiError";
  }
}

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

export const api = {
  listConversations: (accessToken: string) =>
    request<{ conversations: AgentConversation[] }>("/agent/conversations", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  invokeConversationTool: (
    id: string,
    credentials: ConversationCredentials,
    tool: string,
    args: Record<string, unknown> = {},
  ) =>
    request<{ result?: unknown; proposal?: AgentProposal }>(
      `/agent/conversations/${encodeURIComponent(id)}/tools`,
      {
        method: "POST",
        headers: conversationHeaders(credentials),
        body: { tool, args },
      },
    ),
  getProfile: (token: string) =>
    request<ProfileResponse>("/profile", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  saveProfile: (token: string, profile: ApplicantProfileView) =>
    request<ProfileResponse>("/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: { profile },
    }),
  listResumes: (token: string) =>
    request<{ resumes: ResumeView[]; retentionDays: number }>(
      "/profile/resumes",
      { headers: { Authorization: `Bearer ${token}` } },
    ),
  uploadResume: (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ resume: ResumeView }>("/profile/resumes", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      formData,
    });
  },
  extractResume: (token: string, resumeId: string) =>
    request<ResumeExtractionResponse>(
      `/profile/resumes/${encodeURIComponent(resumeId)}/extract`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    ),
  deleteResume: (token: string, resumeId: string) =>
    request<{ deleted: true }>(`/profile/resumes/${encodeURIComponent(resumeId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  shareResume: (token: string, applicationId: string, resumeId: string) =>
    request<{ resumeId: string }>(
      `/applications/${encodeURIComponent(applicationId)}/resume`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: { resumeId },
      },
    ),
  createVoiceSession: (locale: Locale) =>
    request<{ signedUrl: string; expiresInSeconds: number; locale: Locale; voiceSessionToken: string }>(
      "/voice/session",
      { method: "POST", body: { locale } },
    ),
  getVoiceSessionStatus: (voiceSessionToken: string) =>
    request<{
      status: "pending" | "not_submitted" | "duplicate" | "submitted";
      submissionId?: string;
      receiptToken?: string;
    }>("/voice/session/status", {
      headers: { "X-Voice-Session-Token": voiceSessionToken },
    }),
  createConversation: (
    mode: "resident" | "employee",
    locale: Locale,
    credentials: ConversationCredentials = {},
  ) =>
    request<{
      conversation: AgentConversation;
      conversationToken?: string;
      tools: AgentTool[];
    }>("/agent/conversations", {
      method: "POST",
      headers: conversationHeaders(credentials),
      body: { mode, locale },
    }),
  getConversation: (id: string, credentials: ConversationCredentials) =>
    request<{
      conversation: AgentConversation;
      messages: Array<{
        id: string;
        role: "user" | "assistant" | "tool";
        content: string;
        createdAt: string;
      }>;
      proposals: AgentProposal[];
      tools: AgentTool[];
    }>(`/agent/conversations/${encodeURIComponent(id)}`, {
      headers: conversationHeaders(credentials),
    }),
  sendConversationMessage: (
    id: string,
    credentials: ConversationCredentials,
    message: string,
  ) =>
    request<{
      message: string;
      toolResult?: unknown;
      proposal?: AgentProposal;
    }>(`/agent/conversations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      headers: conversationHeaders(credentials),
      body: { message },
    }),
  decideConversationProposal: (
    id: string,
    proposalId: string,
    decision: "approve" | "reject",
    credentials: ConversationCredentials,
    sandboxAcknowledged = false,
    duplicateOverride = false,
  ) =>
    request<{ proposal: AgentProposal; result?: unknown }>(
      `/agent/conversations/${encodeURIComponent(id)}/proposals/${encodeURIComponent(proposalId)}/${decision}`,
      {
        method: "POST",
        headers: conversationHeaders(credentials),
        body:
          decision === "approve"
            ? { approved: true, sandboxAcknowledged, duplicateOverride }
            : {},
      },
    ),
  getEmergencyGuidance: async (locale: Locale) => {
    const response = await request<FeedbackEmergencyResponse>("/feedback", {
      method: "POST",
      body: { emergency: true, locale },
      acceptedStatus: 422,
    });
    if (
      response.accepted !== false ||
      response.emergencyRedirect?.number !== "911" ||
      typeof response.emergencyRedirect.message !== "string"
    ) {
      throw new WorkerApiError(
        "Invalid emergency guidance",
        502,
        "BAD_RESPONSE",
        "",
      );
    }
    return response;
  },
  getPostings: () => request<{ postings: PublicPostingView[] }>("/postings"),
  checkFeedbackDuplicate: (
    message: string,
    municipalityId: string,
    category?: string,
  ) =>
    request<{ duplicate: FeedbackDuplicate | null }>("/feedback/duplicate-check", {
      method: "POST",
      body: { message, municipalityId, ...(category ? { category } : {}) },
    }),
  submitFeedback: (
    message: string,
    whatWouldImprove: string,
    credentials: ReceiptCredentials,
    locale: Locale,
    duplicateOverride = false,
  ) =>
    request<FeedbackSubmitResponse>(
      "/feedback",
      {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
          "X-Receipt-Token": credentials.receiptToken,
        },
        body: {
          message,
          whatWouldImprove,
          municipalityId: "3520005",
          sandboxAcknowledged: true,
          duplicateOverride,
          locale,
        },
      },
    ),
  getReceipt: (credentials: ReceiptCredentials) =>
    request<{ submission: FeedbackClientReceipt }>(
      `/feedback/receipts/${encodeURIComponent(credentials.submissionId)}`,
      { headers: { "X-Receipt-Token": credentials.receiptToken } },
    ),
  addResidentMessage: (credentials: ReceiptCredentials, message: string) =>
    request<{ message: { id: string; body: string; createdAt: string } }>(
      `/feedback/receipts/${encodeURIComponent(credentials.submissionId)}/messages`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
          "X-Receipt-Token": credentials.receiptToken,
        },
        body: { message },
      },
    ),
  getApplications: (token: string) =>
    request<{ applications: ApplicationView[] }>("/applications", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  submitApplication: (
    token: string,
    input: {
      postingId: string;
      answers: Record<string, string>;
      confirmedByApplicant: true;
    },
  ) =>
    request<{ application: ApplicationView }>("/applications", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: input,
    }),
  getStaffFeedback: (token: string, organizationId: string) =>
    request<{ submissions: StaffFeedbackView[] }>(
      `/staff/organizations/${encodeURIComponent(organizationId)}/feedback`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),
  getStaffFeedbackDetail: (
    token: string,
    organizationId: string,
    submissionId: string,
  ) =>
    request<{ submission: FeedbackClientReceipt }>(
      `/staff/organizations/${encodeURIComponent(organizationId)}/feedback/${encodeURIComponent(submissionId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),
  replyToFeedback: (
    token: string,
    organizationId: string,
    submissionId: string,
    message: string,
  ) =>
    request<{ message: { id: string } }>(
      `/staff/organizations/${encodeURIComponent(organizationId)}/feedback/${encodeURIComponent(submissionId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: { message },
      },
    ),
  changeFeedbackStatus: (
    token: string,
    organizationId: string,
    submissionId: string,
    status: FeedbackStatus,
    outcome?: string,
  ) =>
    request<{ submission: { id: string; status: FeedbackStatus } }>(
      `/staff/organizations/${encodeURIComponent(organizationId)}/feedback/${encodeURIComponent(submissionId)}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: { status, ...(outcome ? { outcome } : {}) },
      },
    ),
  getStaffApplications: (token: string, organizationId: string) =>
    request<{ applications: ApplicationView[] }>(
      `/staff/organizations/${encodeURIComponent(organizationId)}/applications`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),
  changeApplicationStatus: (
    token: string,
    organizationId: string,
    applicationId: string,
    status: ApplicationStatus,
  ) =>
    request<{ application: { id: string; status: ApplicationStatus } }>(
      `/staff/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: { status },
      },
    ),
};

function conversationHeaders(
  credentials: ConversationCredentials,
): Record<string, string> {
  return {
    ...(credentials.accessToken
      ? { Authorization: `Bearer ${credentials.accessToken}` }
      : {}),
    ...(credentials.conversationToken
      ? { "X-Conversation-Token": credentials.conversationToken }
      : {}),
    ...(credentials.receiptToken
      ? { "X-Receipt-Token": credentials.receiptToken }
      : {}),
  };
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    formData?: FormData;
    acceptedStatus?: number;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      ...(options.formData
        ? { body: options.formData }
        : options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new WorkerApiError("Network unavailable", 0, "NETWORK_ERROR", "");
  }
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; requestId?: string };
  } | null;
  if (!response.ok && response.status !== options.acceptedStatus) {
    throw new WorkerApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.requestId ?? "",
    );
  }
  if (!payload)
    throw new WorkerApiError("Invalid response", 502, "BAD_RESPONSE", "");
  return payload as T;
}
