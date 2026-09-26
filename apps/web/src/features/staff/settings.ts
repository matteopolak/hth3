import type {
  StaffDefaultView,
  StaffWorkspaceSettings,
} from "@civicresolve/contracts/v1";
import { staffRequest } from "./client.js";
import type { StaffPageContext } from "./types.js";
import {
  button,
  empty,
  errorMessage,
  heading,
  node,
  performAction,
  text,
} from "./ui.js";

export async function mountSettings(context: StaffPageContext): Promise<void> {
  const { host, token, organizationId, locale } = context;
  host.replaceChildren(
    heading(text(locale, "Settings", "Paramètres")),
    node("p", "staff-loading", text(locale, "Loading…", "Chargement…")),
  );
  let settings: StaffWorkspaceSettings;
  try {
    ({ settings } = await staffRequest<{ settings: StaffWorkspaceSettings }>(
      token,
      organizationId,
      "/workspace/settings",
    ));
  } catch (error) {
    host.replaceChildren(
      heading(text(locale, "Settings", "Paramètres")),
      empty(errorMessage(error, locale)),
    );
    return;
  }
  host.replaceChildren(heading(text(locale, "Settings", "Paramètres")));
  const grid = node("div", "staff-settings-grid");
  const personal = node("section", "staff-section staff-settings-section");
  personal.append(
    node("h3", "", text(locale, "Your workspace", "Votre espace")),
  );
  const start = node("label", "staff-field");
  const select = node("select", "staff-select");
  for (const [value, label] of choices(context)) {
    const option = node("option", "", label);
    option.value = value;
    select.append(option);
  }
  select.value = settings.defaultView;
  start.append(
    node(
      "span",
      "staff-field-label",
      text(locale, "Open on sign-in", "Ouvrir à la connexion"),
    ),
    select,
  );
  const savePersonal = button(
    text(locale, "Save preference", "Enregistrer la préférence"),
    () =>
      void save(
        "defaultView",
        select.value,
        settings.personalVersion,
        savePersonal,
        personal,
      ),
    "staff-button",
  );
  personal.append(start, savePersonal);
  grid.append(personal);
  if (context.summary?.capabilities.organizationManage) {
    const organization = node(
      "section",
      "staff-section staff-settings-section",
    );
    organization.append(
      node("h3", "", text(locale, "Organization", "Organisation")),
    );
    const window = node("label", "staff-field");
    const days = node("select", "staff-select");
    for (const count of [7, 30, 90]) {
      const option = node(
        "option",
        "",
        `${count} ${text(locale, "days", "jours")}`,
      );
      option.value = String(count);
      days.append(option);
    }
    days.value = String(settings.reportingWindowDays);
    window.append(
      node(
        "span",
        "staff-field-label",
        text(
          locale,
          "Default saved report window",
          "Période par défaut des rapports enregistrés",
        ),
      ),
      days,
    );
    const saveOrganization = button(
      text(locale, "Save organization setting", "Enregistrer le paramètre"),
      () =>
        void save(
          "reportingWindowDays",
          Number(days.value),
          settings.organizationVersion,
          saveOrganization,
          organization,
        ),
      "staff-button",
    );
    organization.append(window, saveOrganization);
    grid.append(organization);
  }
  host.append(grid);

  async function save(
    key: "defaultView" | "reportingWindowDays",
    value: string | number,
    expectedVersion: number,
    control: HTMLButtonElement,
    panel: HTMLElement,
  ): Promise<void> {
    await performAction(control, panel, locale, async () => {
      const response = await staffRequest<{ settings: StaffWorkspaceSettings }>(
        token,
        organizationId,
        "/workspace/settings",
        "PATCH",
        { [key]: value, expectedVersion },
      );
      if (context.summary) context.summary.settings = response.settings;
      await mountSettings(context);
      const saved = node(
        "p",
        "staff-review-success",
        text(locale, "Saved.", "Enregistré."),
      );
      host.prepend(saved);
    });
  }
}

function choices(context: StaffPageContext): Array<[StaffDefaultView, string]> {
  const { locale } = context;
  const capability = context.summary?.capabilities;
  const result: Array<[StaffDefaultView, string]> = [
    ["assistant", text(locale, "Assistant", "Assistant")],
  ];
  if (capability?.feedbackRead)
    result.push(
      ["overview", text(locale, "Overview", "Vue d’ensemble")],
      ["issues", text(locale, "Inbox", "Boîte de réception")],
      ["themes", text(locale, "Themes", "Thèmes")],
      ["views", text(locale, "Saved views", "Vues enregistrées")],
      ["reports", text(locale, "Reports", "Rapports")],
    );
  if (capability?.postingManage)
    result.push(["hiring", text(locale, "Hiring", "Recrutement")]);
  if (capability?.applicantReview)
    result.push(["applicants", text(locale, "Applicants", "Candidatures")]);
  if (capability?.taxonomyManage)
    result.push(["taxonomy", text(locale, "Taxonomy", "Taxonomie")]);
  if (capability?.auditRead)
    result.push(["audit", text(locale, "Activity log", "Journal d’activité")]);
  return result;
}
