import type {
  ApplicationStatus,
  FeedbackStatus,
  FeedbackReceiptView,
  Locale,
  PublicPostingView,
} from "@civicresolve/contracts/v1";

export interface ApplicationView {
  id: string;
  postingId: string;
  postingTitle: string;
  status: ApplicationStatus;
  sample: true;
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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8787/api/v1").replace(/\/$/, "");

export const api = {
  getPostings: () =>
    request<{ postings: PublicPostingView[] }>("/postings"),
  submitFeedback: (
    message: string,
    whatWouldImprove: string,
    credentials: ReceiptCredentials,
    locale: Locale,
  ) =>
    request<{ submission: FeedbackClientReceipt; receiptToken: string }>(
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

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    headers?: Record<string, string>;
    body?: unknown;
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
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new WorkerApiError("Network unavailable", 0, "NETWORK_ERROR", "");
  }
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { code?: string; message?: string; requestId?: string };
      }
    | null;
  if (!response.ok) {
    throw new WorkerApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.requestId ?? "",
    );
  }
  if (!payload) throw new WorkerApiError("Invalid response", 502, "BAD_RESPONSE", "");
  return payload as T;
}
