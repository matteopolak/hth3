import type { PublicPostingView, ResumeView } from "@civicresolve/contracts/v1";
import { api, type ApplicationView } from "../../platform/api.js";

export interface Posting extends PublicPostingView {
  location?: string;
}
export interface OfficialJob {
  id: string;
  origin: "official_external" | "participating_org" | "sample";
  type: "job_posting" | "jobs_finder";
  title: string;
  summary: string;
  publisher: string;
  sourceUrl: string;
  verified: boolean;
  verifiedAt: string | null;
  freshness: "current" | "stale" | "expired" | "error" | "unknown";
  jurisdiction: { name: string };
  listing: {
    category: "job";
    postedDate: string | null;
    closingDate: string | null;
    locationText: string | null;
    applicationStatus: "open" | "closed" | "unknown";
  } | null;
  handoff: {
    url: string;
    publisher: string;
    verifyOnPublisherSite: true;
    externalSubmissionRecorded: false;
  } | null;
}
export interface ApplicationMessage {
  id: string;
  author: "applicant" | "employer";
  body: string;
  createdAt: string;
}

const base = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

async function direct<T>(
  path: string,
  token: string | null,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? `Request failed (${response.status})`,
    );
  return payload as T;
}

export const applicationsApi = {
  postings: async () => (await api.getPostings()).postings as Posting[],
  official: async (): Promise<OfficialJob[]> =>
    (
      await direct<{ items: OfficialJob[] }>(
        "/discovery?area=jobs&type=job_posting&limit=100",
        null,
      )
    ).items.filter(
      (item) =>
        item.origin === "official_external" &&
        item.type === "job_posting" &&
        item.verified &&
        item.freshness === "current" &&
        item.listing?.applicationStatus !== "closed" &&
        item.handoff?.url.startsWith("https://"),
    ),
  finders: async (): Promise<OfficialJob[]> =>
    (
      await direct<{ items: OfficialJob[] }>(
        "/discovery?area=jobs&type=jobs_finder&includeFinders=true&limit=30",
        null,
      )
    ).items.filter(
      (item) =>
        item.origin === "official_external" &&
        item.type === "jobs_finder" &&
        item.verified &&
        item.handoff?.url.startsWith("https://"),
    ),
  own: async (token: string): Promise<ApplicationView[]> =>
    (await api.getApplications(token)).applications,
  resumes: async (token: string): Promise<ResumeView[]> =>
    (await api.listResumes(token)).resumes,
  upload: async (token: string, file: File): Promise<ResumeView> =>
    (await api.uploadResume(token, file)).resume,
  extract: (token: string, resumeId: string) =>
    api.extractResume(token, resumeId),
  submit: async (
    token: string,
    postingId: string,
    answers: Record<string, string>,
  ): Promise<ApplicationView> =>
    (
      await api.submitApplication(token, {
        postingId,
        answers,
        confirmedByApplicant: true,
      })
    ).application,
  shareResume: (token: string, applicationId: string, resumeId: string) =>
    api.shareResume(token, applicationId, resumeId),
  messages: async (
    token: string,
    applicationId: string,
  ): Promise<ApplicationMessage[]> =>
    (
      await direct<{ messages: ApplicationMessage[] }>(
        `/applications/${encodeURIComponent(applicationId)}/messages`,
        token,
      )
    ).messages,
  message: async (
    token: string,
    applicationId: string,
    message: string,
  ): Promise<ApplicationMessage> =>
    (
      await direct<{ message: ApplicationMessage }>(
        `/applications/${encodeURIComponent(applicationId)}/messages`,
        token,
        "POST",
        { message },
      )
    ).message,
};
