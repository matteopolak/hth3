import { mountAnalytics } from "./analytics.js";
import { mountApplicants } from "./applicants.js";
import { mountHiring } from "./hiring.js";
import { mountTaxonomy } from "./taxonomy.js";
import { mountThemes } from "./themes.js";
import type { StaffWorkspaceOptions } from "./types.js";
import { empty, node, text } from "./ui.js";
import "./staff.css";

export { staffFeedbackOperations } from "./feedback-operations.js";
export type { StaffFeedbackOperationsOptions } from "./feedback-operations.js";
export type { StaffWorkspaceOptions, StaffWorkspaceView } from "./types.js";

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
  const context = { ...options, host };
  switch (options.view) {
    case "overview":
    case "themes":
      void mountThemes(context);
      break;
    case "taxonomy":
      void mountTaxonomy(context);
      break;
    case "hiring":
      void mountHiring(context);
      break;
    case "applicants":
      void mountApplicants(context);
      break;
    case "analytics":
      void mountAnalytics(context);
      break;
  }
  return host;
}
