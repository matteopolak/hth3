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

export type GuestFeedbackCreateRequest =
  | { emergency: true; locale?: Locale }
  | {
      message: string;
      whatWouldImprove?: string;
      category?: string;
      municipalityId: string;
      sandboxAcknowledged: true;
      emergency?: false;
      locale?: Locale;
      evidence?: Array<{
        fileName: string;
        contentType: "application/pdf" | "image/jpeg" | "image/png";
        data: string;
      }>;
    };

export interface FeedbackEmergencyResponse {
  apiVersion: typeof API_VERSION;
  accepted: false;
  emergencyRedirect: { number: "911"; message: string };
}

export interface GuestFeedbackCreateResponse {
  apiVersion: typeof API_VERSION;
  submission: FeedbackReceiptView;
  receiptToken: string;
}

export interface FeedbackReceiptView {
  id: string;
  originalText: string;
  constructiveFollowUp: string | null;
  category: string;
  intent: string | null;
  classificationReviewStatus: string | null;
  municipality: { id: string; name: string; province: string } | null;
  sample: boolean;
  destinationLabel: string | null;
  status: FeedbackStatus;
  departmentName: string | null;
  messages: Array<{
    id: string;
    author: "resident" | "staff";
    body: string;
    createdAt: string;
  }>;
  evidence: Array<{
    id: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    downloadPath: string;
  }>;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackMessageRequest {
  message: string;
}

export interface FeedbackReopenRequest extends FeedbackMessageRequest {}

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
    sample: boolean;
    submittedAt: string;
  };
}

export interface ApplicationStatusChangeRequest {
  status: ApplicationStatus;
}

export interface ApplicantProfileView {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  education: Array<{
    institution: string;
    credential: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  experience: Array<{
    organization: string;
    title: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
}

export interface ProfileResponse {
  apiVersion: typeof API_VERSION;
  profile: ApplicantProfileView | null;
  updatedAt: string | null;
}

export interface ResumeView {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
  retentionExpiresAt: string;
}

export interface ResumeExtractionResponse {
  apiVersion: typeof API_VERSION;
  extraction: {
    resumeId: string;
    text: string;
    suggestions: Array<{
      field: keyof ApplicantProfileView;
      value: string | string[];
      source: { start: number; end: number; text: string };
    }>;
    suggestionsTruncated: boolean;
    extractedAt: string;
  };
}

export type OutboxEvent =
  | FeedbackSubmittedEvent
  | FeedbackMessageAddedEvent
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

export interface FeedbackMessageAddedEvent extends OutboxEventBase {
  eventType: "feedback.message_added";
  submissionId: string;
  payload: { author: "resident" | "staff"; messageLength: number };
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
  payload: { status: "submitted"; sample: boolean };
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
  sample: boolean;
}
