import type {
  StaffWorkspaceCapabilities,
  StaffWorkspaceSummary,
} from "@civicresolve/contracts/v1";
import { mountAudit } from "./audit.js";
import { mountAnalytics } from "./analytics.js";
import { mountApplicants } from "./applicants.js";
import { staffRequest } from "./client.js";
import { mountHiring } from "./hiring.js";
import { mountSavedWorkspace } from "./saved-workspace.js";
import { mountSettings } from "./settings.js";
import { mountTaxonomy } from "./taxonomy.js";
import { mountThemes } from "./themes.js";
import type { StaffWorkspaceOptions, StaffWorkspaceView } from "./types.js";
import { empty, errorMessage, heading, node, text } from "./ui.js";
import "./staff.css";

export { staffFeedbackOperations } from "./feedback-operations.js";
export type { StaffFeedbackOperationsOptions } from "./feedback-operations.js";
export type { StaffWorkspaceOptions, StaffWorkspaceView } from "./types.js";
export type { StaffWorkspaceSummary } from "@civicresolve/contracts/v1";

export function loadStaffWorkspaceSummary(
  token: string,
  organizationId: string,
): Promise<StaffWorkspaceSummary> {
  return staffRequest<StaffWorkspaceSummary>(
    token,
    organizationId,
    "/workspace",
  );
}

export function staffWorkspace(options: StaffWorkspaceOptions): HTMLElement {
  const host = node("div", "staff-workspace");
  if (!options.token) {
    host.append(
      empty(
        text(
          options.locale,
          "Sign in with a staff account to continue.",
          "Connectez-vous avec un compte du personnel pour continuer.",
        ),
      ),
    );
    return host;
  }
  host.append(
    node("p", "staff-loading", text(options.locale, "Loading…", "Chargement…")),
  );
  void loadView();
  return host;

  async function loadView(): Promise<void> {
    let summary: StaffWorkspaceSummary;
    try {
      summary =
        options.summary ??
        (await loadStaffWorkspaceSummary(
          options.token,
          options.organizationId,
        ));
    } catch (error) {
      host.replaceChildren(empty(errorMessage(error, options.locale)));
      return;
    }
    if (!viewAllowed(options.view, summary.capabilities)) {
      host.replaceChildren(
        heading(
          text(options.locale, "Access unavailable", "Accès indisponible"),
        ),
        empty(
          text(
            options.locale,
            "This account cannot open this workspace.",
            "Ce compte ne peut pas ouvrir cet espace.",
          ),
        ),
      );
      return;
    }
    const context = { ...options, host };
    switch (options.view) {
      case "overview":
      case "themes":
        await mountThemes(context);
        break;
      case "taxonomy":
        await mountTaxonomy(context);
        break;
      case "hiring":
        await mountHiring(context);
        break;
      case "applicants":
        await mountApplicants(context);
        break;
      case "analytics":
        await mountAnalytics(context);
        break;
      case "audit":
        mountAudit(context, summary.auditEvents);
        break;
      case "views":
      case "reports":
        await mountSavedWorkspace(context, options.view);
        break;
      case "settings":
        await mountSettings(context);
        break;
    }
  }
}

export function viewAllowed(
  view: StaffWorkspaceView,
  capabilities: StaffWorkspaceCapabilities,
): boolean {
  switch (view) {
    case "overview":
    case "themes":
    case "analytics":
    case "views":
    case "reports":
      return capabilities.feedbackRead;
    case "taxonomy":
      return capabilities.taxonomyManage;
    case "hiring":
      return capabilities.postingManage;
    case "applicants":
      return capabilities.applicantReview;
    case "audit":
      return capabilities.auditRead;
    case "settings":
      return Object.values(capabilities).some(Boolean);
  }
}
