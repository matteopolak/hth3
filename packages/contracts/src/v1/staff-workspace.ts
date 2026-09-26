import type { API_VERSION } from "./index.js";

export interface StaffWorkspaceCapabilities {
  feedbackRead: boolean;
  feedbackRespond: boolean;
  applicantReview: boolean;
  postingManage: boolean;
  taxonomyManage: boolean;
  sourceManage: boolean;
  auditRead: boolean;
}

export interface StaffAuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface StaffWorkspaceSummary {
  apiVersion: typeof API_VERSION;
  organizationId: string;
  capabilities: StaffWorkspaceCapabilities;
  auditEvents: StaffAuditEvent[];
}
