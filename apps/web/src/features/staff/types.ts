import type { Locale, StaffWorkspaceSummary } from "@civicresolve/contracts/v1";

export type StaffWorkspaceView =
  | "overview"
  | "themes"
  | "taxonomy"
  | "hiring"
  | "applicants"
  | "analytics"
  | "audit"
  | "views"
  | "reports"
  | "settings";

export interface StaffWorkspaceOptions {
  view: StaffWorkspaceView;
  token: string;
  organizationId: string;
  locale: Locale;
  summary?: StaffWorkspaceSummary;
  onOpenFeedback?: (id: string) => void;
}

export interface StaffPageContext extends StaffWorkspaceOptions {
  host: HTMLElement;
}
