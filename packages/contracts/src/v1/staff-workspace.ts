import type { API_VERSION } from "./index.js";

export interface StaffWorkspaceCapabilities {
  feedbackRead: boolean;
  feedbackRespond: boolean;
  applicantReview: boolean;
  postingManage: boolean;
  taxonomyManage: boolean;
  sourceManage: boolean;
  organizationManage: boolean;
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
  settings: StaffWorkspaceSettings;
}

export type StaffDefaultView =
  | "assistant"
  | "issues"
  | "overview"
  | "themes"
  | "analytics"
  | "hiring"
  | "applicants"
  | "taxonomy"
  | "audit"
  | "views"
  | "reports"
  | "settings";

export interface StaffWorkspaceSettings {
  defaultView: StaffDefaultView;
  personalVersion: number;
  reportingWindowDays: 7 | 30 | 90;
  organizationVersion: number;
  updatedAt: string | null;
}

export interface StaffSavedView {
  id: string;
  name: string;
  days: 7 | 30 | 90;
  status: string;
  category: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffSavedReport {
  id: string;
  name: string;
  days: 7 | 30 | 90;
  groupBy: "status" | "category" | "intent";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffWorkspaceResult {
  total: number;
  rows: Array<{ key: string; count: number }>;
  sourceIds: string[];
  generatedAt: string;
}

export interface StaffSavedViewResult {
  total: number;
  submissions: Array<{
    id: string;
    status: string;
    category: string;
    createdAt: string;
  }>;
  generatedAt: string;
}
