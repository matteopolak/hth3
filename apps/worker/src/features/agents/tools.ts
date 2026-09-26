import { handleApplicationRequest } from "../application-core/index.js";
import { handleAnalyticsRequest } from "../analytics/index.js";
import { handleConsultationRequest } from "../consultations/index.js";
import { handleDiscoveryRequest } from "../discovery/index.js";
import { handleEmployerRequest } from "../employer/index.js";
import { handleExternalPreparationRequest } from "../external-preparation/index.js";
import { handleFeedbackRequest } from "../feedback-core/index.js";
import { handleNearbyRequest } from "../nearby/index.js";
import { handleProfileRequest } from "../profile/index.js";
import { handleProgramIntakeRequest } from "../program-intake/index.js";
import { handleSourceRequest } from "../sources/index.js";
import { handleTaxonomyRequest } from "../taxonomy/index.js";
import { handleThemesRequest } from "../themes/index.js";
import type {
  AgentContext,
  AgentMode,
  ToolAccess,
  ToolArguments,
} from "./types.js";

type Handler = typeof handleApplicationRequest;
type ToolDefinition = {
  mode: AgentMode | "both";
  access: ToolAccess;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: (args: ToolArguments, organizationId: string | null) => string;
  handler: Handler;
  body?: (args: ToolArguments) => unknown;
};

function identifier(args: ToolArguments, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(value))
    throw new ToolInputError(`${key} must be an identifier.`);
  return value;
}

function feedbackId(args: ToolArguments): string {
  const value = args.id;
  if (typeof value !== "string" || !/^fb_[a-f0-9]{32}$/.test(value))
    throw new ToolInputError("id must be a feedback identifier.");
  return value;
}

function evidenceId(args: ToolArguments): string {
  const value = args.assetId;
  if (typeof value !== "string" || !/^asset_[a-f0-9]{32}$/.test(value))
    throw new ToolInputError("assetId must be an evidence identifier.");
  return value;
}

function organizationPath(organizationId: string | null): string {
  if (!organizationId) throw new ToolInputError("An organization is required.");
  return `/api/v1/staff/organizations/${organizationId}`;
}

function object(args: ToolArguments, key: string): Record<string, unknown> {
  const value = args[key];
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ToolInputError(`${key} must be an object.`);
  return value as Record<string, unknown>;
}

function array(args: ToolArguments, key: string): unknown[] {
  const value = args[key];
  if (!Array.isArray(value))
    throw new ToolInputError(`${key} must be an array.`);
  return value;
}

function string(args: ToolArguments, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0)
    throw new ToolInputError(`${key} is required.`);
  return value;
}

function optionalSubject(args: ToolArguments): string | null {
  const value = args.assigneeSubject;
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 240 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new ToolInputError(
      "assigneeSubject must be an account identifier or null.",
    );
  return value;
}

function sourceRecordId(args: ToolArguments): string {
  const value = args.id;
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  )
    throw new ToolInputError("id must be a source record identifier.");
  return value;
}

function themeId(args: ToolArguments): string {
  const value = args.id;
  if (typeof value !== "string" || !/^theme_[a-f0-9]{32}$/.test(value))
    throw new ToolInputError("id must be a theme identifier.");
  return value;
}

function consultationId(args: ToolArguments): string {
  const value = args.id;
  if (typeof value !== "string" || !/^[a-z0-9-]{1,120}$/.test(value))
    throw new ToolInputError("id must be a consultation identifier.");
  return value;
}

function discoveryQuery(
  args: ToolArguments,
  fields: readonly string[],
): string {
  const params = new URLSearchParams();
  for (const field of fields) {
    const value = args[field];
    if (value === undefined || value === null || value === "") continue;
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    )
      throw new ToolInputError(`${field} must be a simple filter.`);
    params.set(field, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export class ToolInputError extends Error {}

export const AGENT_TOOLS: Record<string, ToolDefinition> = {
  list_postings: {
    mode: "both",
    access: "read",
    description: "List available first-party postings.",
    method: "GET",
    path: () => "/api/v1/postings",
    handler: handleApplicationRequest,
  },
  read_posting: {
    mode: "both",
    access: "read",
    description: "Open a posting by id.",
    method: "GET",
    path: (args) => `/api/v1/postings/${identifier(args, "id")}`,
    handler: handleApplicationRequest,
  },
  list_programs: {
    mode: "both",
    access: "read",
    description:
      "List published first-party grants and benefit programs with practice status and sponsor.",
    method: "GET",
    path: () => "/api/v1/programs",
    handler: handleProgramIntakeRequest,
  },
  read_program: {
    mode: "both",
    access: "read",
    description:
      "Open one published grant or benefit program and its intake questions.",
    method: "GET",
    path: (args) => `/api/v1/programs/${identifier(args, "id")}`,
    handler: handleProgramIntakeRequest,
  },
  list_sources: {
    mode: "both",
    access: "read",
    description: "List cited public source publishers.",
    method: "GET",
    path: (args) =>
      `/api/v1/sources${args.includeSamples === true ? "?includeSamples=true" : ""}`,
    handler: handleSourceRequest,
  },
  list_source_records: {
    mode: "both",
    access: "read",
    description: "Search imported public source records.",
    method: "GET",
    path: (args) =>
      `/api/v1/source-records${args.includeSamples === true ? "?includeSamples=true" : ""}`,
    handler: handleSourceRequest,
  },
  read_source_record: {
    mode: "both",
    access: "read",
    description: "Open an imported source record by id.",
    method: "GET",
    path: (args) =>
      `/api/v1/source-records/${sourceRecordId(args)}${args.includeSamples === true ? "?includeSamples=true" : ""}`,
    handler: handleSourceRequest,
  },
  search_nearby: {
    mode: "both",
    access: "read",
    description:
      "Find source-backed nearby public services, including category, address, hours, accessibility, map precision and verification evidence.",
    method: "GET",
    path: (args) =>
      `/api/v1/nearby${discoveryQuery(args, ["category", "q", "location", "freshness", "limit", "offset", "includeSamples"])}`,
    handler: handleNearbyRequest,
  },
  list_consultations: {
    mode: "both",
    access: "read",
    description:
      "List reviewed official public consultations and participation directories, optionally by jurisdiction; participation stays on the publisher site.",
    method: "GET",
    path: (args) =>
      `/api/v1/consultations${discoveryQuery(args, ["jurisdiction"])}`,
    handler: handleConsultationRequest,
  },
  read_consultation: {
    mode: "both",
    access: "read",
    description:
      "Read a consultation's publisher, deadline, source state and participation status.",
    method: "GET",
    path: (args) => `/api/v1/consultations/${consultationId(args)}`,
    handler: handleConsultationRequest,
  },
  get_consultation_handoff: {
    mode: "both",
    access: "read",
    description:
      "Get the official consultation site and current participation status. This does not submit or record a contribution.",
    method: "GET",
    path: (args) => `/api/v1/consultations/${consultationId(args)}/handoff`,
    handler: handleConsultationRequest,
  },
  search_discovery: {
    mode: "both",
    access: "read",
    description:
      "Search real sourced jobs, support, funding, offices and participation records with filters.",
    method: "GET",
    path: (args) =>
      `/api/v1/discovery${discoveryQuery(args, ["area", "type", "audience", "status", "source", "location", "q", "jurisdiction", "language", "freshness", "limit", "offset", "includeSamples"])}`,
    handler: handleDiscoveryRequest,
  },
  read_discovery_item: {
    mode: "both",
    access: "read",
    description: "Open one sourced discovery item and its provenance.",
    method: "GET",
    path: (args) =>
      `/api/v1/discovery/${sourceRecordId(args)}${discoveryQuery(args, ["includeSamples"])}`,
    handler: handleDiscoveryRequest,
  },
  get_official_handoff: {
    mode: "both",
    access: "read",
    description:
      "Get the verified official external destination. Opening the link does not record an application or report submission.",
    method: "GET",
    path: (args) =>
      `/api/v1/discovery/${sourceRecordId(args)}/handoff${discoveryQuery(args, ["includeSamples"])}`,
    handler: handleDiscoveryRequest,
  },
  list_saved_discovery: {
    mode: "resident",
    access: "read",
    description:
      "List the signed-in resident's saved sourced items and checklists.",
    method: "GET",
    path: (args) =>
      `/api/v1/discovery/saved${discoveryQuery(args, ["includeSamples"])}`,
    handler: handleDiscoveryRequest,
  },
  save_discovery_item: {
    mode: "resident",
    access: "write",
    description:
      "Prepare saving a sourced item, optionally replacing its checklist of up to 12 entries.",
    method: "PUT",
    path: (args) =>
      `/api/v1/discovery/saved/${sourceRecordId(args)}${discoveryQuery(args, ["includeSamples"])}`,
    handler: handleDiscoveryRequest,
    body: (args) => ({ checklist: args.checklist }),
  },
  remove_saved_discovery_item: {
    mode: "resident",
    access: "write",
    description: "Prepare removing a saved sourced item and its checklist.",
    method: "DELETE",
    path: (args) => `/api/v1/discovery/saved/${sourceRecordId(args)}`,
    handler: handleDiscoveryRequest,
  },
  list_external_preparations: {
    mode: "resident",
    access: "read",
    description:
      "List the signed-in resident's saved preparation drafts for official external opportunities.",
    method: "GET",
    path: () => "/api/v1/external-preparations",
    handler: handleExternalPreparationRequest,
  },
  read_external_preparation: {
    mode: "resident",
    access: "read",
    description:
      "Read an official external opportunity and the resident's saved answers and checklist if signed in.",
    method: "GET",
    path: (args) => `/api/v1/external-preparations/${sourceRecordId(args)}`,
    handler: handleExternalPreparationRequest,
  },
  save_external_preparation: {
    mode: "resident",
    access: "write",
    description:
      "Prepare saving answers and checklist for an official external opportunity; this does not submit to the publisher.",
    method: "PUT",
    path: (args) => `/api/v1/external-preparations/${sourceRecordId(args)}`,
    handler: handleExternalPreparationRequest,
    body: (args) => ({ answers: args.answers, checklist: args.checklist }),
  },
  delete_external_preparation: {
    mode: "resident",
    access: "write",
    description:
      "Prepare deleting the resident's saved external preparation draft.",
    method: "DELETE",
    path: (args) => `/api/v1/external-preparations/${sourceRecordId(args)}`,
    handler: handleExternalPreparationRequest,
  },
  export_external_preparation: {
    mode: "resident",
    access: "read",
    description:
      "Get a text download path for prepared answers and checklist, without recording an external submission.",
    method: "GET",
    path: (args) =>
      `/api/v1/external-preparations/${sourceRecordId(args)}/export${discoveryQuery(args, ["locale"])}`,
    handler: handleExternalPreparationRequest,
  },
  list_reusable_answers: {
    mode: "resident",
    access: "read",
    description:
      "List the signed-in resident's private reusable application answers.",
    method: "GET",
    path: () => "/api/v1/external-preparations/answers",
    handler: handleExternalPreparationRequest,
  },
  save_reusable_answer: {
    mode: "resident",
    access: "write",
    description: "Prepare saving one private reusable application answer.",
    method: "PUT",
    path: (args) =>
      `/api/v1/external-preparations/answers/${identifier(args, "id")}`,
    handler: handleExternalPreparationRequest,
    body: (args) => ({
      label: string(args, "label"),
      response: string(args, "response"),
    }),
  },
  delete_reusable_answer: {
    mode: "resident",
    access: "write",
    description: "Prepare deleting one private reusable application answer.",
    method: "DELETE",
    path: (args) =>
      `/api/v1/external-preparations/answers/${identifier(args, "id")}`,
    handler: handleExternalPreparationRequest,
  },
  read_profile: {
    mode: "resident",
    access: "read",
    description: "Read the signed-in resident's private profile.",
    method: "GET",
    path: () => "/api/v1/profile",
    handler: handleProfileRequest,
  },
  list_resumes: {
    mode: "resident",
    access: "read",
    description: "List the signed-in resident's resumes.",
    method: "GET",
    path: () => "/api/v1/profile/resumes",
    handler: handleProfileRequest,
  },
  prepare_resume_upload: {
    mode: "resident",
    access: "read",
    description:
      "Check résumé access and ask the resident to choose a PDF or DOCX in the chat file picker. This tool does not upload a file itself.",
    method: "GET",
    path: () => "/api/v1/profile/resumes",
    handler: handleProfileRequest,
  },
  read_resume: {
    mode: "resident",
    access: "read",
    description: "Get the private download path for an uploaded resume.",
    method: "GET",
    path: (args) => `/api/v1/profile/resumes/${identifier(args, "id")}`,
    handler: handleProfileRequest,
  },
  read_resume_extraction: {
    mode: "resident",
    access: "read",
    description: "Read saved extraction suggestions for a resume.",
    method: "GET",
    path: (args) =>
      `/api/v1/profile/resumes/${identifier(args, "id")}/extraction`,
    handler: handleProfileRequest,
  },
  list_my_applications: {
    mode: "resident",
    access: "read",
    description: "List the resident's applications.",
    method: "GET",
    path: () => "/api/v1/applications",
    handler: handleApplicationRequest,
  },
  read_my_application: {
    mode: "resident",
    access: "read",
    description: "Read one of the resident's applications.",
    method: "GET",
    path: (args) => `/api/v1/applications/${identifier(args, "id")}`,
    handler: handleApplicationRequest,
  },
  read_feedback_receipt: {
    mode: "resident",
    access: "read",
    description:
      "Read a guest feedback receipt; requires its private receipt token.",
    method: "GET",
    path: (args) => `/api/v1/feedback/receipts/${feedbackId(args)}`,
    handler: handleFeedbackRequest,
  },
  check_feedback_duplicate: {
    mode: "resident",
    access: "read",
    description:
      "Check for a strong recent match in the same municipality and category. Returns only a matching case's current status, never its text or identity.",
    method: "POST",
    path: () => "/api/v1/feedback/duplicate-check",
    handler: handleFeedbackRequest,
    body: (args) => ({
      message: string(args, "message"),
      municipalityId: string(args, "municipalityId"),
      category: args.category,
    }),
  },
  read_feedback_attachment: {
    mode: "resident",
    access: "read",
    description:
      "Get an attachment download path from the resident's private feedback receipt; receipt token required.",
    method: "GET",
    path: (args) =>
      `/api/v1/feedback/receipts/${feedbackId(args)}/attachments/${evidenceId(args)}`,
    handler: handleFeedbackRequest,
  },
  emergency_guidance: {
    mode: "resident",
    access: "read",
    description:
      "Get localized emergency guidance instead of creating ordinary feedback.",
    method: "POST",
    path: () => "/api/v1/feedback",
    handler: handleFeedbackRequest,
    body: (args) => ({
      emergency: true,
      locale: args.locale === "fr" ? "fr" : "en",
    }),
  },
  create_feedback: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a new civic feedback report. Requires message, municipalityId and sandboxAcknowledged true. The user must approve the preview.",
    method: "POST",
    path: () => "/api/v1/feedback",
    handler: handleFeedbackRequest,
    body: (args) => ({
      message: string(args, "message"),
      municipalityId: string(args, "municipalityId"),
      whatWouldImprove: args.whatWouldImprove,
      category: args.category,
      sandboxAcknowledged: args.sandboxAcknowledged,
      duplicateOverride: false,
      locale: args.locale,
    }),
  },
  reply_feedback: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a reply to the resident's feedback receipt; private receipt token required at approval.",
    method: "POST",
    path: (args) => `/api/v1/feedback/receipts/${feedbackId(args)}/messages`,
    handler: handleFeedbackRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  reopen_feedback: {
    mode: "resident",
    access: "write",
    description:
      "Prepare additional information to reopen a closed feedback receipt.",
    method: "POST",
    path: (args) => `/api/v1/feedback/receipts/${feedbackId(args)}/reopen`,
    handler: handleFeedbackRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  submit_application: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a first-party application for explicit approval; signed-in applicant required.",
    method: "POST",
    path: () => "/api/v1/applications",
    handler: handleApplicationRequest,
    body: (args) => ({
      postingId: identifier(args, "postingId"),
      answers: object(args, "answers"),
      confirmedByApplicant: true,
    }),
  },
  update_profile: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a private profile update for explicit approval; signed-in applicant required.",
    method: "PUT",
    path: () => "/api/v1/profile",
    handler: handleProfileRequest,
    body: (args) => ({ profile: object(args, "profile") }),
  },
  delete_profile: {
    mode: "resident",
    access: "write",
    description: "Prepare deletion of the resident's private profile.",
    method: "DELETE",
    path: () => "/api/v1/profile",
    handler: handleProfileRequest,
  },
  extract_resume: {
    mode: "resident",
    access: "write",
    description: "Prepare text extraction from an already uploaded resume.",
    method: "POST",
    path: (args) => `/api/v1/profile/resumes/${identifier(args, "id")}/extract`,
    handler: handleProfileRequest,
  },
  delete_resume: {
    mode: "resident",
    access: "write",
    description: "Prepare deletion of an already uploaded resume.",
    method: "DELETE",
    path: (args) => `/api/v1/profile/resumes/${identifier(args, "id")}`,
    handler: handleProfileRequest,
  },
  share_resume: {
    mode: "resident",
    access: "write",
    description:
      "Prepare explicit resume sharing with one of the resident's applications.",
    method: "PUT",
    path: (args) =>
      `/api/v1/applications/${identifier(args, "applicationId")}/resume`,
    handler: handleProfileRequest,
    body: (args) => ({ resumeId: identifier(args, "resumeId") }),
  },
  read_application_messages: {
    mode: "resident",
    access: "read",
    description:
      "Read messages on one of the signed-in resident's applications.",
    method: "GET",
    path: (args) => `/api/v1/applications/${identifier(args, "id")}/messages`,
    handler: handleEmployerRequest,
  },
  send_application_message: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a message to a participating employer about the resident's own application.",
    method: "POST",
    path: (args) => `/api/v1/applications/${identifier(args, "id")}/messages`,
    handler: handleEmployerRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  list_my_program_applications: {
    mode: "resident",
    access: "read",
    description:
      "List the signed-in resident's first-party program applications.",
    method: "GET",
    path: () => "/api/v1/program-applications",
    handler: handleProgramIntakeRequest,
  },
  read_my_program_application: {
    mode: "resident",
    access: "read",
    description: "Read one of the signed-in resident's program applications.",
    method: "GET",
    path: (args) => `/api/v1/program-applications/${identifier(args, "id")}`,
    handler: handleProgramIntakeRequest,
  },
  submit_program_application: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a reviewed in-app grant or benefit application. A practice sponsor needs separate acknowledgment before approval.",
    method: "POST",
    path: () => "/api/v1/program-applications",
    handler: handleProgramIntakeRequest,
    body: (args) => ({
      programId: identifier(args, "programId"),
      answers: object(args, "answers"),
      confirmedByApplicant: true,
      sandboxAcknowledged: false,
    }),
  },
  read_program_application_messages: {
    mode: "resident",
    access: "read",
    description: "Read messages on one of the resident's program applications.",
    method: "GET",
    path: (args) =>
      `/api/v1/program-applications/${identifier(args, "id")}/messages`,
    handler: handleProgramIntakeRequest,
  },
  send_program_application_message: {
    mode: "resident",
    access: "write",
    description:
      "Prepare a message to the sponsor of the resident's own program application.",
    method: "POST",
    path: (args) =>
      `/api/v1/program-applications/${identifier(args, "id")}/messages`,
    handler: handleProgramIntakeRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  list_staff_feedback: {
    mode: "employee",
    access: "read",
    description: "List feedback assigned to this staff member's organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/feedback`,
    handler: handleFeedbackRequest,
  },
  list_feedback_assignment_options: {
    mode: "employee",
    access: "read",
    description:
      "List active departments and eligible staff members for assigning organization feedback cases.",
    method: "GET",
    path: (_args, org) =>
      `${organizationPath(org)}/feedback/assignment-options`,
    handler: handleFeedbackRequest,
  },
  read_feedback_analytics: {
    mode: "employee",
    access: "read",
    description:
      "Read organization feedback counts and trends for the last 1 to 90 days.",
    method: "GET",
    path: (args, org) => {
      const days =
        typeof args.days === "number" && Number.isInteger(args.days)
          ? Math.max(1, Math.min(90, args.days))
          : 30;
      return `${organizationPath(org)}/analytics?days=${days}`;
    },
    handler: handleAnalyticsRequest,
  },
  list_feedback_themes: {
    mode: "employee",
    access: "read",
    description:
      "Read feedback overview counts, trends and evidence-linked themes with optional period and filters.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/themes${discoveryQuery(args, ["days", "category", "department", "status"])}`,
    handler: handleThemesRequest,
  },
  read_feedback_theme: {
    mode: "employee",
    access: "read",
    description:
      "Open one theme and its original supporting feedback submissions.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/themes/${themeId(args)}${discoveryQuery(args, ["limit", "offset"])}`,
    handler: handleThemesRequest,
  },
  theme_candidates: {
    mode: "employee",
    access: "read",
    description:
      "Inspect same-category similarity suggestions for staff review. Results never move a submission; a separate approved membership action is required.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/themes/candidates`,
    handler: handleThemesRequest,
  },
  refresh_feedback_themes: {
    mode: "employee",
    access: "write",
    description:
      "Prepare an explicit refresh of organization feedback theme groups.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/themes/refresh`,
    handler: handleThemesRequest,
  },
  review_feedback_theme_membership: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a reviewed move of one organization feedback submission into a same-category theme.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/themes/${themeId(args)}/memberships`,
    handler: handleThemesRequest,
    body: (args) => ({ submissionId: feedbackId({ id: args.submissionId }) }),
  },
  read_staff_feedback: {
    mode: "employee",
    access: "read",
    description: "Read one feedback case in the staff member's organization.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}`,
    handler: handleFeedbackRequest,
  },
  list_staff_feedback_messages: {
    mode: "employee",
    access: "read",
    description: "Read messages in an organization feedback case.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/messages`,
    handler: handleFeedbackRequest,
  },
  read_staff_feedback_attachment: {
    mode: "employee",
    access: "read",
    description:
      "Get the authorized download path for evidence attached to an organization feedback case.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/attachments/${evidenceId(args)}`,
    handler: handleFeedbackRequest,
  },
  list_staff_applications: {
    mode: "employee",
    access: "read",
    description: "List applicants in this staff member's organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/applications`,
    handler: handleApplicationRequest,
  },
  list_organization_programs: {
    mode: "employee",
    access: "read",
    description:
      "List first-party grant and benefit programs owned by this organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/programs`,
    handler: handleProgramIntakeRequest,
  },
  read_organization_program: {
    mode: "employee",
    access: "read",
    description:
      "Read one of this organization's program forms and current version.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/programs/${identifier(args, "id")}`,
    handler: handleProgramIntakeRequest,
  },
  create_organization_program: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a draft grant or benefit intake with a reviewed question set.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/programs`,
    handler: handleProgramIntakeRequest,
    body: (args) => ({
      kind: string(args, "kind"),
      title: string(args, "title"),
      summary: string(args, "summary"),
      questions: array(args, "questions"),
    }),
  },
  edit_organization_program: {
    mode: "employee",
    access: "write",
    description:
      "Prepare edits to a draft program's kind, title, summary or intake questions.",
    method: "PATCH",
    path: (args, org) =>
      `${organizationPath(org)}/programs/${identifier(args, "id")}`,
    handler: handleProgramIntakeRequest,
    body: (args) => ({
      kind: args.kind,
      title: args.title,
      summary: args.summary,
      questions: args.questions,
    }),
  },
  publish_organization_program: {
    mode: "employee",
    access: "write",
    description:
      "Prepare publication of a draft program; sponsor verification is rechecked on approval.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/programs/${identifier(args, "id")}/publish`,
    handler: handleProgramIntakeRequest,
  },
  close_organization_program: {
    mode: "employee",
    access: "write",
    description: "Prepare closing a published first-party program.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/programs/${identifier(args, "id")}/close`,
    handler: handleProgramIntakeRequest,
  },
  list_staff_program_applications: {
    mode: "employee",
    access: "read",
    description: "List applicants to this organization's first-party programs.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/program-applications`,
    handler: handleProgramIntakeRequest,
  },
  read_staff_program_application: {
    mode: "employee",
    access: "read",
    description: "Read one program application in the current organization.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/program-applications/${identifier(args, "id")}`,
    handler: handleProgramIntakeRequest,
  },
  change_program_application_status: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a reviewed program application status update within the allowed transition graph.",
    method: "PATCH",
    path: (args, org) =>
      `${organizationPath(org)}/program-applications/${identifier(args, "id")}/status`,
    handler: handleProgramIntakeRequest,
    body: (args) => ({ status: string(args, "status") }),
  },
  read_staff_program_application_messages: {
    mode: "employee",
    access: "read",
    description: "Read messages on an organization program application.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/program-applications/${identifier(args, "id")}/messages`,
    handler: handleProgramIntakeRequest,
  },
  send_staff_program_application_message: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a message to one of this organization's program applicants.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/program-applications/${identifier(args, "id")}/messages`,
    handler: handleProgramIntakeRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  read_staff_application: {
    mode: "employee",
    access: "read",
    description:
      "Open one application in the employee's authorized organization.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/applications/${identifier(args, "id")}`,
    handler: handleEmployerRequest,
  },
  read_staff_application_messages: {
    mode: "employee",
    access: "read",
    description: "Read the conversation on an organization application.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/applications/${identifier(args, "id")}/messages`,
    handler: handleEmployerRequest,
  },
  read_staff_resume: {
    mode: "employee",
    access: "read",
    description:
      "Get the authorized download path for a resume shared with an organization application.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/applications/${identifier(args, "applicationId")}/resume`,
    handler: handleProfileRequest,
  },
  staff_reply_feedback: {
    mode: "employee",
    access: "write",
    description: "Prepare a response to a feedback case for approval.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/messages`,
    handler: handleFeedbackRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  staff_change_feedback_status: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a feedback status change; outcome is required for outcome_recorded.",
    method: "PATCH",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/status`,
    handler: handleFeedbackRequest,
    body: (args) => ({ status: string(args, "status"), outcome: args.outcome }),
  },
  staff_assign_feedback: {
    mode: "employee",
    access: "write",
    description:
      "Prepare assigning a feedback case to an active department and an eligible staff member in this organization; null clears the assignee.",
    method: "PATCH",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/assignment`,
    handler: handleFeedbackRequest,
    body: (args) => ({
      departmentId: identifier(args, "departmentId"),
      assigneeSubject: optionalSubject(args),
    }),
  },
  staff_request_feedback_details: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a question to the resident and move the case to waiting on resident.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/request-details`,
    handler: handleFeedbackRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  staff_record_feedback_outcome: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a reviewed case outcome summary and mark the case outcome recorded.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/outcome`,
    handler: handleFeedbackRequest,
    body: (args) => ({ summary: string(args, "summary") }),
  },
  staff_change_application_status: {
    mode: "employee",
    access: "write",
    description:
      "Prepare an applicant status change. Never infer protected traits or automatically reject applicants.",
    method: "PATCH",
    path: (args, org) =>
      `${organizationPath(org)}/applications/${identifier(args, "id")}/status`,
    handler: handleApplicationRequest,
    body: (args) => ({ status: string(args, "status") }),
  },
  list_organization_postings: {
    mode: "employee",
    access: "read",
    description:
      "List draft, published and closed postings owned by this organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/postings`,
    handler: handleEmployerRequest,
  },
  read_organization_posting: {
    mode: "employee",
    access: "read",
    description: "Read one organization posting and its current version.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/postings/${identifier(args, "id")}`,
    handler: handleEmployerRequest,
  },
  create_organization_posting: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a new organization posting draft with title, description and location.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/postings`,
    handler: handleEmployerRequest,
    body: (args) => ({
      title: string(args, "title"),
      description: string(args, "description"),
      location: string(args, "location"),
    }),
  },
  edit_organization_posting: {
    mode: "employee",
    access: "write",
    description:
      "Prepare edits to an organization posting's title, description or location.",
    method: "PATCH",
    path: (args, org) =>
      `${organizationPath(org)}/postings/${identifier(args, "id")}`,
    handler: handleEmployerRequest,
    body: (args) => ({
      title: args.title,
      description: args.description,
      location: args.location,
    }),
  },
  publish_organization_posting: {
    mode: "employee",
    access: "write",
    description:
      "Prepare publication of a draft posting; verification policy is rechecked on approval.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/postings/${identifier(args, "id")}/publish`,
    handler: handleEmployerRequest,
  },
  close_organization_posting: {
    mode: "employee",
    access: "write",
    description: "Prepare closure of a published posting.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/postings/${identifier(args, "id")}/close`,
    handler: handleEmployerRequest,
  },
  send_staff_application_message: {
    mode: "employee",
    access: "write",
    description: "Prepare a message to an applicant in this organization.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/applications/${identifier(args, "id")}/messages`,
    handler: handleEmployerRequest,
    body: (args) => ({ message: string(args, "message") }),
  },
  record_application_decision: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a shortlist, offer or decline decision with an optional applicant message; requires explicit human approval.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/applications/${identifier(args, "id")}/decision`,
    handler: handleEmployerRequest,
    body: (args) => ({ status: string(args, "status"), message: args.message }),
  },
  read_taxonomy: {
    mode: "employee",
    access: "read",
    description:
      "Read the published taxonomy and any authorized draft for this organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/taxonomy`,
    handler: handleTaxonomyRequest,
  },
  list_taxonomy_versions: {
    mode: "employee",
    access: "read",
    description:
      "List this organization's historical published taxonomy versions and any authorized draft.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/taxonomy/versions`,
    handler: handleTaxonomyRequest,
  },
  read_taxonomy_version: {
    mode: "employee",
    access: "read",
    description: "Open one historical taxonomy version by id.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/taxonomy/versions/${identifier(args, "id")}`,
    handler: handleTaxonomyRequest,
  },
  preview_taxonomy: {
    mode: "employee",
    access: "read",
    description:
      "Preview how a draft taxonomy would classify supplied text without publishing it.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/taxonomy/preview`,
    handler: handleTaxonomyRequest,
    body: (args) => ({ text: string(args, "text") }),
  },
  read_classification: {
    mode: "employee",
    access: "read",
    description:
      "Read the current classification and department routing for an organization feedback case.",
    method: "GET",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/classification`,
    handler: handleTaxonomyRequest,
  },
  create_taxonomy_draft: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a new editable taxonomy draft from the published version.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/taxonomy/draft`,
    handler: handleTaxonomyRequest,
  },
  edit_taxonomy_draft: {
    mode: "employee",
    access: "write",
    description:
      "Prepare replacement of the organization taxonomy draft document.",
    method: "PATCH",
    path: (_args, org) => `${organizationPath(org)}/taxonomy/draft`,
    handler: handleTaxonomyRequest,
    body: (args) => ({ document: object(args, "document") }),
  },
  publish_taxonomy_draft: {
    mode: "employee",
    access: "write",
    description:
      "Prepare publication of the current taxonomy draft after review.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/taxonomy/publish`,
    handler: handleTaxonomyRequest,
  },
  correct_classification: {
    mode: "employee",
    access: "write",
    description:
      "Prepare a reviewed category and intent correction for a feedback case, with a reason.",
    method: "POST",
    path: (args, org) =>
      `${organizationPath(org)}/feedback/${feedbackId(args)}/classification`,
    handler: handleTaxonomyRequest,
    body: (args) => ({
      categoryId: string(args, "categoryId"),
      intent: string(args, "intent"),
      reason: string(args, "reason"),
    }),
  },
};

export function visibleTools(
  mode: AgentMode,
): Array<{ name: string; access: ToolAccess; description: string }> {
  return Object.entries(AGENT_TOOLS)
    .filter(([, tool]) => tool.mode === mode || tool.mode === "both")
    .map(([name, tool]) => ({
      name,
      access: tool.access,
      description: tool.description,
    }));
}

export function prepareTool(
  name: string,
  args: ToolArguments,
  mode: AgentMode,
  organizationId: string | null,
) {
  const tool = AGENT_TOOLS[name];
  if (!tool || (tool.mode !== mode && tool.mode !== "both"))
    throw new ToolInputError("Tool is unavailable in this conversation.");
  const path = tool.path(args, organizationId);
  const body = tool.body?.(args);
  return {
    tool,
    path,
    body,
    preview: { name, method: tool.method, path, body: body ?? null },
  };
}

export async function executeTool(
  request: Request,
  context: AgentContext,
  prepared: ReturnType<typeof prepareTool>,
  receiptToken?: string,
  approvalKey?: string,
): Promise<{ status: number; data: unknown }> {
  const url = new URL(prepared.path, request.url);
  const headers = new Headers();
  for (const key of ["Authorization", "Accept-Language", "CF-Connecting-IP"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (receiptToken) headers.set("X-Receipt-Token", receiptToken);
  if (approvalKey) headers.set("Idempotency-Key", approvalKey);
  if (prepared.body !== undefined)
    headers.set("Content-Type", "application/json");
  const internal = new Request(url, {
    method: prepared.tool.method,
    headers,
    ...(prepared.body !== undefined
      ? { body: JSON.stringify(prepared.body) }
      : {}),
  });
  const response = await prepared.tool.handler(internal, url, context);
  if (!response)
    return { status: 404, data: { error: { code: "TOOL_ROUTE_UNAVAILABLE" } } };
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return { status: response.status, data: { downloadPath: prepared.path } };
  }
  return { status: response.status, data: (await response.json()) as unknown };
}
