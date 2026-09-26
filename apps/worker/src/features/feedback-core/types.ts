import type { FeedbackStatus } from "@civicresolve/contracts/v1";
import type { R2Bucket } from "@civicresolve/db/d1";
import type { FeedbackCategory } from "@civicresolve/domain/feedback";
import type { FeatureContext } from "../shared.js";

export type FeedbackContext = FeatureContext & {
  env: FeatureContext["env"] & {
    PRIVATE_ASSETS?: R2Bucket;
    FEEDBACK_ABUSE_HMAC_KEY?: string;
  };
};

export interface GuestFeedbackCreateBody {
  message?: unknown;
  whatWouldImprove?: unknown;
  municipalityId?: unknown;
  sandboxAcknowledged?: unknown;
  emergency?: unknown;
  locale?: unknown;
  category?: unknown;
  evidence?: unknown;
  feedbackEvidenceAssetIds?: unknown;
  duplicateOverride?: unknown;
}

export interface GuestFeedbackDuplicateCheckBody {
  message?: unknown;
  municipalityId?: unknown;
  category?: unknown;
}

export interface FeedbackDuplicateCandidateRow {
  original_text: string;
  status: FeedbackStatus;
}

export interface FeedbackMessageBody {
  message?: unknown;
}

export interface FeedbackStatusBody {
  status?: unknown;
  outcome?: unknown;
}

export interface FeedbackAssignmentBody {
  departmentId?: unknown;
  assigneeSubject?: unknown;
}

export interface FeedbackRequestDetailsBody {
  message?: unknown;
}

export interface FeedbackOutcomeBody {
  summary?: unknown;
}

export interface FeedbackStaffAssignmentRow {
  submission_id: string;
  organization_id: string;
  department_id: string;
  department_name_en: string;
  department_name_fr: string;
  assignee_subject: string | null;
  assigned_by: string;
  updated_at: string;
}

export interface FeedbackDepartmentRow {
  id: string;
  name_en: string;
  name_fr: string;
  jurisdiction_level: string;
}

export interface FeedbackAssigneeRow {
  user_subject: string;
  role: "civic_staff" | "organization_admin";
}

export interface EvidenceInput {
  fileName: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  data: string;
}

export interface EvidenceMetadata {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

export interface FeedbackRow {
  id: string;
  status: FeedbackStatus;
  receipt_token_hash: string;
  department_name: string | null;
  outcome: string | null;
  sample: number;
  created_at: string;
  updated_at: string;
  original_text?: string;
  constructive_follow_up?: string | null;
  category?: string;
  intent?: string | null;
  classification_review_status?: string | null;
  municipality_csd_uid?: string | null;
  municipality_name?: string | null;
  province_name?: string | null;
  organization_id?: string | null;
}

export interface FeedbackMessageRow {
  id: string;
  author_kind: "resident" | "staff";
  body: string;
  created_at: string;
}

export interface PrivateAssetRow {
  id: string;
  organization_id: string | null;
  owner_subject: string;
  purpose: "feedback_attachment";
  record_id: string;
  object_key: string;
  filename: string;
  content_type: string;
  byte_size: number;
  created_at: string;
}

export interface IdempotentFeedbackResponse {
  submissionId?: string;
  messageId?: string;
  status?: FeedbackStatus;
}

export const MAX_MESSAGE_LENGTH = 5_000;
export const MAX_FOLLOW_UP_LENGTH = 2_000;
export const MAX_OUTCOME_LENGTH = 2_000;
export const MAX_EVIDENCE_FILES = 3;
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_REQUEST_BYTES = 15 * 1024 * 1024;
export const SAMPLE_ORGANIZATION_ID = "org_43G1B1RhPwac7EjS";
export const TORONTO_CSDUID = "3520005";
export const RECEIPT_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export const STAFF_FEEDBACK_ACTIONS = {
  read: "feedback:read_organization",
  respond: "feedback:respond_organization",
} as const;
