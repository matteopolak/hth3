import type { Locale } from "@civicresolve/contracts/v1";

export type StaffWorkspaceView =
  | "overview"
  | "themes"
  | "taxonomy"
  | "hiring"
  | "applicants"
  | "analytics";

export interface StaffWorkspaceOptions {
  view: StaffWorkspaceView;
  token: string;
  organizationId: string;
  locale: Locale;
  onOpenFeedback?: (id: string) => void;
}

export interface StaffPageContext extends StaffWorkspaceOptions {
  host: HTMLElement;
}
