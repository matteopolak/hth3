import type {
  StaffSavedReport,
  StaffSavedView,
  StaffSavedViewResult,
  StaffWorkspaceResult,
} from "@civicresolve/contracts/v1";
import { staffRequest } from "./client.js";
import type { StaffPageContext } from "./types.js";
import {
  button,
  date,
  empty,
  errorMessage,
  heading,
  node,
  performAction,
  setError,
  status,
  text,
} from "./ui.js";

type Kind = "views" | "reports";
type Saved = StaffSavedView | StaffSavedReport;

export async function mountSavedWorkspace(
  context: StaffPageContext,
  kind: Kind,
): Promise<void> {
  const { host, token, organizationId, locale } = context;
  host.replaceChildren(
    heading(
      kind === "views"
        ? text(locale, "Saved views", "Vues enregistrées")
        : text(locale, "Reports", "Rapports"),
    ),
    node("p", "staff-loading", text(locale, "Loading…", "Chargement…")),
  );
  let items: Saved[];
  try {
    const response = await staffRequest<{
      views?: StaffSavedView[];
      reports?: StaffSavedReport[];
    }>(token, organizationId, `/workspace/${kind}`);
    items =
      kind === "views" ? (response.views ?? []) : (response.reports ?? []);
  } catch (error) {
    host.replaceChildren(
      heading(
        kind === "views"
          ? text(locale, "Saved views", "Vues enregistrées")
          : text(locale, "Reports", "Rapports"),
      ),
      empty(errorMessage(error, locale)),
    );
    return;
  }
  const create = button(
    kind === "views"
      ? text(locale, "New view", "Nouvelle vue")
      : text(locale, "New report", "Nouveau rapport"),
    () => showEditor(),
  );
  host.replaceChildren(
    heading(
      kind === "views"
        ? text(locale, "Saved views", "Vues enregistrées")
        : text(locale, "Reports", "Rapports"),
      create,
    ),
  );
  const layout = node("div", "staff-saved-layout");
  const list = node("div", "staff-saved-list");
  const detail = node("section", "staff-saved-detail");
  layout.append(list, detail);
  host.append(layout);
  if (!items.length)
    list.append(
      empty(
        kind === "views"
          ? text(locale, "No saved views yet.", "Aucune vue enregistrée.")
          : text(locale, "No reports yet.", "Aucun rapport pour le moment."),
      ),
    );
  for (const item of items) {
    const select = button(item.name, () => void open(item), "staff-saved-item");
    select.append(
      node(
        "small",
        "",
        `${item.days} ${text(locale, "days", "jours")} · ${kind === "views" ? (item as StaffSavedView).status || text(locale, "All statuses", "Tous les états") : groupLabel((item as StaffSavedReport).groupBy, locale)}`,
      ),
    );
    list.append(select);
  }
  if (items[0]) void open(items[0]);
  else
    detail.append(
      empty(
        kind === "views"
          ? text(
              locale,
              "Save filters to return to a feedback queue.",
              "Enregistrez des filtres pour retrouver une liste de signalements.",
            )
          : text(
              locale,
              "Save a report to track exact counts.",
              "Enregistrez un rapport pour suivre les chiffres exacts.",
            ),
      ),
    );

  function showEditor(existing?: Saved): void {
    detail.replaceChildren();
    const title = node(
      "h3",
      "",
      existing
        ? text(locale, "Edit", "Modifier")
        : text(locale, "Create", "Créer"),
    );
    const form = node("form", "staff-saved-form");
    const name = fieldControl(
      text(locale, "Name", "Nom"),
      existing?.name ?? "",
    );
    const window = selectControl(
      text(locale, "Window", "Période"),
      [
        ["7", text(locale, "7 days", "7 jours")],
        ["30", text(locale, "30 days", "30 jours")],
        ["90", text(locale, "90 days", "90 jours")],
      ],
      String(
        existing?.days ?? context.summary?.settings.reportingWindowDays ?? 30,
      ),
    );
    form.append(name.label, window.label);
    let statusFilter: ReturnType<typeof selectControl> | null = null;
    let categoryFilter: ReturnType<typeof fieldControl> | null = null;
    let group: ReturnType<typeof selectControl> | null = null;
    if (kind === "views") {
      statusFilter = selectControl(
        text(locale, "Status", "État"),
        [
          ["", text(locale, "All statuses", "Tous les états")],
          ...[
            "submitted",
            "acknowledged",
            "in_review",
            "waiting_on_resident",
            "outcome_recorded",
            "closed",
            "reopened",
          ].map((value) => [value, status(value, locale)] as [string, string]),
        ],
        (existing as StaffSavedView | undefined)?.status ?? "",
      );
      categoryFilter = fieldControl(
        text(locale, "Category ID (optional)", "ID de catégorie (facultatif)"),
        (existing as StaffSavedView | undefined)?.category ?? "",
      );
      form.append(statusFilter.label, categoryFilter.label);
    } else {
      group = selectControl(
        text(locale, "Group by", "Regrouper par"),
        [
          ["status", text(locale, "Status", "État")],
          ["category", text(locale, "Category", "Catégorie")],
          ["intent", text(locale, "Intent", "Intention")],
        ],
        (existing as StaffSavedReport | undefined)?.groupBy ?? "status",
      );
      form.append(group.label);
    }
    const save = button(
      text(locale, "Save", "Enregistrer"),
      () => void persist(),
      "staff-button",
    );
    const cancel = button(
      text(locale, "Cancel", "Annuler"),
      () => (existing ? void open(existing) : detail.replaceChildren()),
      "staff-button secondary",
    );
    form.append(node("div", "staff-actions", ""));
    form.lastElementChild!.append(save, cancel);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void persist();
    });
    detail.append(title, form);

    async function persist(): Promise<void> {
      const value = name.input.value.trim();
      if (!value || value.length > 80) {
        setError(
          detail,
          text(
            locale,
            "Enter a name up to 80 characters.",
            "Saisissez un nom de 80 caractères maximum.",
          ),
        );
        return;
      }
      const body =
        kind === "views"
          ? {
              name: value,
              days: Number(window.input.value),
              status: statusFilter!.input.value,
              category: categoryFilter!.input.value.trim(),
              ...(existing ? { expectedVersion: existing.version } : {}),
            }
          : {
              name: value,
              days: Number(window.input.value),
              groupBy: group!.input.value,
              ...(existing ? { expectedVersion: existing.version } : {}),
            };
      await performAction(save, detail, locale, async () => {
        await staffRequest(
          token,
          organizationId,
          existing
            ? `/workspace/${kind}/${encodeURIComponent(existing.id)}`
            : `/workspace/${kind}`,
          existing ? "PATCH" : "POST",
          body,
        );
        await mountSavedWorkspace(context, kind);
      });
    }
  }

  async function open(item: Saved): Promise<void> {
    for (const control of list.querySelectorAll<HTMLButtonElement>(
      ".staff-saved-item",
    ))
      control.classList.toggle(
        "is-selected",
        control.firstChild?.textContent === item.name,
      );
    detail.replaceChildren(
      node("p", "staff-loading", text(locale, "Loading…", "Chargement…")),
    );
    try {
      const result = await staffRequest<
        StaffSavedViewResult | StaffWorkspaceResult
      >(
        token,
        organizationId,
        `/workspace/${kind}/${encodeURIComponent(item.id)}/result`,
      );
      const header = node("div", "staff-saved-header");
      header.append(
        node("h3", "", item.name),
        node("strong", "staff-saved-total", String(result.total)),
      );
      const actions = node("div", "staff-actions");
      actions.append(
        button(
          text(locale, "Edit", "Modifier"),
          () => showEditor(item),
          "staff-button secondary",
        ),
      );
      const remove = button(
        text(locale, "Delete", "Supprimer"),
        () => void removeItem(item, remove),
        "staff-button secondary",
      );
      actions.append(remove);
      detail.replaceChildren(
        header,
        actions,
        node(
          "p",
          "staff-muted",
          `${item.days} ${text(locale, "days", "jours")} · ${text(locale, "Updated", "Mis à jour")} ${date(item.updatedAt, locale)}`,
        ),
      );
      if (kind === "views") {
        const view = result as StaffSavedViewResult;
        if (!view.submissions.length)
          detail.append(
            empty(
              text(
                locale,
                "No matching feedback.",
                "Aucun signalement correspondant.",
              ),
            ),
          );
        const rows = node("div", "staff-saved-results");
        for (const submission of view.submissions) {
          const link = button(
            `${submission.category || text(locale, "Unclassified", "Non classé")} · ${status(submission.status, locale)}`,
            () => context.onOpenFeedback?.(submission.id),
            "staff-saved-result",
          );
          link.disabled = !context.onOpenFeedback;
          link.append(
            node(
              "small",
              "",
              `${submission.id} · ${date(submission.createdAt, locale)}`,
            ),
          );
          rows.append(link);
        }
        detail.append(rows);
        if (view.total > view.submissions.length)
          detail.append(
            node(
              "p",
              "staff-muted",
              `${view.submissions.length} ${text(locale, "most recent shown", "plus récents affichés")}`,
            ),
          );
      } else {
        const report = result as StaffWorkspaceResult;
        const rows = node("div", "staff-saved-results");
        const max = Math.max(1, ...report.rows.map((row) => row.count));
        for (const row of report.rows) {
          const line = node("div", "staff-report-row");
          line.append(
            node("span", "", row.key),
            node("span", "staff-report-bar"),
            node("strong", "", String(row.count)),
          );
          (line.children[1] as HTMLElement).style.setProperty(
            "--bar-width",
            `${Math.max(4, (row.count / max) * 100)}%`,
          );
          rows.append(line);
        }
        detail.append(rows);
        if (!report.rows.length)
          detail.append(
            empty(
              text(
                locale,
                "No feedback in this period.",
                "Aucun signalement pendant cette période.",
              ),
            ),
          );
        if (report.sourceIds.length) {
          const sources = node("details", "staff-saved-sources");
          sources.append(
            node(
              "summary",
              "",
              text(locale, "Open source cases", "Ouvrir les dossiers sources"),
            ),
          );
          for (const id of report.sourceIds) {
            const link = button(
              id,
              () => context.onOpenFeedback?.(id),
              "staff-source-link",
            );
            link.disabled = !context.onOpenFeedback;
            sources.append(link);
          }
          detail.append(sources);
        }
      }
    } catch (error) {
      detail.replaceChildren(empty(errorMessage(error, locale)));
    }
  }

  async function removeItem(
    item: Saved,
    control: HTMLButtonElement,
  ): Promise<void> {
    if (
      !window.confirm(
        text(
          locale,
          "Delete this saved item?",
          "Supprimer cet élément enregistré?",
        ),
      )
    )
      return;
    await performAction(control, detail, locale, async () => {
      await staffRequest(
        token,
        organizationId,
        `/workspace/${kind}/${encodeURIComponent(item.id)}`,
        "DELETE",
        { expectedVersion: item.version },
      );
      await mountSavedWorkspace(context, kind);
    });
  }
}

function fieldControl(
  label: string,
  value: string,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = node("label", "staff-field");
  const input = node("input");
  input.value = value;
  input.maxLength = 80;
  wrapper.append(node("span", "staff-field-label", label), input);
  return { label: wrapper, input };
}

function selectControl(
  label: string,
  values: Array<[string, string]>,
  selected: string,
): { label: HTMLLabelElement; input: HTMLSelectElement } {
  const wrapper = node("label", "staff-field");
  const input = node("select", "staff-select");
  for (const [value, display] of values) {
    const option = node("option", "", display);
    option.value = value;
    input.append(option);
  }
  input.value = selected;
  wrapper.append(node("span", "staff-field-label", label), input);
  return { label: wrapper, input };
}

function groupLabel(
  group: StaffSavedReport["groupBy"],
  locale: StaffPageContext["locale"],
): string {
  return group === "category"
    ? text(locale, "Category", "Catégorie")
    : group === "intent"
      ? text(locale, "Intent", "Intention")
      : text(locale, "Status", "État");
}
