import { handleApplicationRequest } from "../application-core/index.js";
import { handleAnalyticsRequest } from "../analytics/index.js";
import { handleDiscoveryRequest } from "../discovery/index.js";
import { handleEmployerRequest } from "../employer/index.js";
import { handleFeedbackRequest } from "../feedback-core/index.js";
import { handleProfileRequest } from "../profile/index.js";
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

function string(args: ToolArguments, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0)
    throw new ToolInputError(`${key} is required.`);
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
  search_discovery: {
    mode: "both",
    access: "read",
    description:
      "Search real sourced jobs, support, funding, offices and participation records with filters.",
    method: "GET",
    path: (args) =>
      `/api/v1/discovery${discoveryQuery(args, ["area", "q", "jurisdiction", "language", "freshness", "limit", "offset", "includeSamples"])}`,
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
  list_staff_feedback: {
    mode: "employee",
    access: "read",
    description: "List feedback assigned to this staff member's organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/feedback`,
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
  refresh_feedback_themes: {
    mode: "employee",
    access: "write",
    description:
      "Prepare an explicit refresh of organization feedback theme groups.",
    method: "POST",
    path: (_args, org) => `${organizationPath(org)}/themes/refresh`,
    handler: handleThemesRequest,
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
  list_staff_applications: {
    mode: "employee",
    access: "read",
    description: "List applicants in this staff member's organization.",
    method: "GET",
    path: (_args, org) => `${organizationPath(org)}/applications`,
    handler: handleApplicationRequest,
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
  for (const key of ["Authorization", "Accept-Language"]) {
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
