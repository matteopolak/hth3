import type { ApplicationStatus } from "@civicresolve/contracts/v1";
export interface TaxonomyDocument {
  groups: Array<{
    id: string;
    name: { en: string; fr: string };
    order: number;
  }>;
  categories: Array<{
    id: string;
    groupId: string;
    name: { en: string; fr: string };
    description: { en: string; fr: string };
    inclusionExamples: Array<{ en: string; fr: string }>;
    exclusionExamples: Array<{ en: string; fr: string }>;
    followUpFields: Array<{ id: string; label: { en: string; fr: string } }>;
    destinationDepartmentId: string;
    jurisdictionLevel: "municipal" | "provincial" | "federal" | "mixed";
    order: number;
    retired: boolean;
  }>;
}

export interface Theme {
  id: string;
  categoryId: string;
  title: { en: string; fr: string };
  summary: { en: string; fr: string };
  count: number;
  previousCount: number;
  change: number;
  sample: boolean;
  summaryEvidenceRestricted: boolean;
  summaryGeneratedAt: string | null;
  summaryStale: boolean;
  sourceIds: string[];
}

export interface ThemesResponse {
  totalSubmissions: number;
  previousTotalSubmissions: number;
  unansweredSubmissions: number;
  generatedAt: string;
  analyticsAsOf: string | null;
  analyticsPendingEvents: number;
  categories: Array<{ key: string; count: number }>;
  intents: Array<{ key: string; count: number }>;
  statuses: Array<{ key: string; count: number }>;
  daily: Array<{ day: string; count: number }>;
  themes: Theme[];
}

export interface ThemeCandidate {
  submissionId: string;
  currentThemeId: string;
  suggestedThemeId: string;
  categoryId: string;
  sourceIds: [string, string];
  similarityScore: number;
  reviewRequired: true;
}

export interface ThemeCandidatesResponse {
  groundingStatus:
    | "disabled"
    | "capacity_limit"
    | "provider_unavailable"
    | "grounded";
  reviewRequired: true;
  suggestions: ThemeCandidate[];
}

export interface ThemeDetail {
  theme: Theme;
  totalSubmissions: number;
  sources: Array<{
    id: string;
    status: string;
    createdAt: string;
    originalText: string;
    constructiveFollowUp: string | null;
    sample: boolean;
  }>;
}

export interface TaxonomyVersion {
  id: string;
  version: number;
  status: string;
  document: TaxonomyDocument;
  createdAt: string;
  publishedAt: string | null;
}

export interface TaxonomyResponse {
  published: TaxonomyVersion | null;
  draft: TaxonomyVersion | null;
  departments: Array<{
    id: string;
    name_en: string;
    name_fr: string;
    active: number;
  }>;
}

export interface Posting {
  id: string;
  title: string;
  description: string;
  location: string;
  status: "draft" | "published" | "closed";
  sample: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface Application {
  id: string;
  postingId: string;
  postingTitle: string;
  applicantSubject: string;
  answers: Record<string, string>;
  status: ApplicationStatus;
  sample: boolean;
  submittedAt: string;
  updatedAt: string;
}

export interface ApplicationMessage {
  id: string;
  author: "applicant" | "employer";
  body: string;
  createdAt: string;
}

export interface AnalyticsResponse {
  windowDays: number;
  generatedAt: string;
  synchronizedThrough: string | null;
  pendingEvents: number;
  daily: Array<{
    day: string;
    category: string;
    intent: string;
    sample: boolean;
    count: number;
  }>;
  categories: Array<{
    category: string;
    intent: string;
    sample: boolean;
    count: number;
  }>;
  operational: Record<string, number>;
}

const base = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

export class StaffApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function staffRequest<T>(
  token: string,
  organizationId: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(
    `${base}/staff/organizations/${encodeURIComponent(organizationId)}${path}`,
    {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(method === "GET" ? {} : { "Idempotency-Key": crypto.randomUUID() }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: string } })
    | null;
  if (!response.ok) {
    throw new StaffApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
    );
  }
  if (!payload)
    throw new StaffApiError("Invalid response", 502, "BAD_RESPONSE");
  return payload;
}

export async function downloadStaffResume(
  token: string,
  organizationId: string,
  applicationId: string,
): Promise<void> {
  const response = await fetch(
    `${base}/staff/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/resume`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    throw new StaffApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
    );
  }
  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="?([^";]+)"?/)?.[1] ?? "resume";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
