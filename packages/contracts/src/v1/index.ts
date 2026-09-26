export const API_VERSION = "v1" as const;

export type Locale = "en" | "fr";
export type ActorKind = "guest" | "applicant" | "staff" | "system";

export type FeedbackStatus =
  | "submitted"
  | "acknowledged"
  | "in_review"
  | "waiting_on_resident"
  | "outcome_recorded"
  | "closed"
  | "reopened";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "information_requested"
  | "shortlisted"
  | "declined"
  | "offer";

export interface ApiErrorResponse {
  apiVersion: typeof API_VERSION;
  error: { code: string; message: string; requestId: string };
}

export interface GuestFeedbackCreateRequest {
  message: string;
}

export interface GuestFeedbackCreateResponse {
  apiVersion: typeof API_VERSION;
  submission: FeedbackReceiptView;
  receiptToken: string;
}

export interface FeedbackReceiptView {
  id: string;
  status: FeedbackStatus;
  departmentName: string | null;
  messages: Array<{
    id: string;
    author: "resident" | "staff";
    body: string;
    createdAt: string;
  }>;
  outcome: string | null;
}

export interface FeedbackMessageRequest {
  message: string;
}

export interface FeedbackStatusChangeRequest {
  status: FeedbackStatus;
  outcome?: string;
}

export interface ApplicationSubmissionRequest {
  postingId: string;
  answers: Record<string, string>;
  confirmedByApplicant: true;
}

export interface ApplicationSubmissionResponse {
  apiVersion: typeof API_VERSION;
  application: {
    id: string;
    postingId: string;
    status: ApplicationStatus;
    sample: true;
    submittedAt: string;
  };
}

export interface ApplicationStatusChangeRequest {
  status: ApplicationStatus;
  message?: string;
}

export type OutboxEvent =
  | FeedbackSubmittedEvent
  | FeedbackStatusChangedEvent
  | ApplicationSubmittedEvent
  | ApplicationStatusChangedEvent;

interface OutboxEventBase {
  schemaVersion: "1.0";
  eventId: string;
  occurredAt: string;
  actor: {
    kind: ActorKind;
    subjectId: string | null;
    organizationId: string | null;
  };
}

export interface FeedbackSubmittedEvent extends OutboxEventBase {
  eventType: "feedback.submitted";
  submissionId: string;
  payload: { status: "submitted"; messageLength: number };
}

export interface FeedbackStatusChangedEvent extends OutboxEventBase {
  eventType: "feedback.status_changed";
  submissionId: string;
  payload: { previousStatus: FeedbackStatus; status: FeedbackStatus };
}

export interface ApplicationSubmittedEvent extends OutboxEventBase {
  eventType: "application.submitted";
  applicationId: string;
  postingId: string;
  payload: { status: "submitted"; sample: true };
}

export interface ApplicationStatusChangedEvent extends OutboxEventBase {
  eventType: "application.status_changed";
  applicationId: string;
  postingId: string;
  payload: { previousStatus: ApplicationStatus; status: ApplicationStatus };
}

export interface PublicPostingView {
  id: string;
  organizationName: string;
  title: string;
  description: string;
  sample: true;
}
