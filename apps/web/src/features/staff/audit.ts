import type { StaffAuditEvent } from "@civicresolve/contracts/v1";
import type { StaffPageContext } from "./types.js";
import { date, empty, heading, node, text } from "./ui.js";

export function mountAudit(
  context: StaffPageContext,
  events: StaffAuditEvent[],
): void {
  const { host, locale } = context;
  host.replaceChildren(
    heading(text(locale, "Activity log", "Journal d’activité")),
  );
  if (!events.length) {
    host.append(
      empty(
        text(
          locale,
          "No recorded changes yet.",
          "Aucune modification consignée.",
        ),
      ),
    );
    return;
  }
  const list = node("div", "staff-audit-list");
  for (const event of events) {
    const item = node("article", "staff-audit-event");
    const label = node("div", "staff-audit-main");
    label.append(
      node("strong", "", actionLabel(event.action, locale)),
      node(
        "span",
        "",
        `${entityLabel(event.entityType, locale)} · ${date(event.createdAt, locale)}`,
      ),
    );
    item.append(label);
    const detail = node("details", "staff-audit-detail");
    detail.append(
      node(
        "summary",
        "",
        text(locale, "Record details", "Détails de l’enregistrement"),
      ),
      node("code", "", event.entityId),
    );
    item.append(detail);
    list.append(item);
  }
  host.append(list);
}

function actionLabel(
  value: string,
  locale: StaffPageContext["locale"],
): string {
  const words = value.replaceAll(/[._-]+/g, " ");
  return locale === "fr"
    ? words
    : words.charAt(0).toUpperCase() + words.slice(1);
}

function entityLabel(
  value: string,
  locale: StaffPageContext["locale"],
): string {
  const known: Record<string, [string, string]> = {
    feedback: ["Feedback", "Signalement"],
    application: ["Application", "Candidature"],
    posting: ["Posting", "Offre"],
    taxonomy: ["Taxonomy", "Taxonomie"],
    theme: ["Theme", "Thème"],
    program: ["Program", "Programme"],
  };
  return known[value]?.[locale === "fr" ? 1 : 0] ?? value.replaceAll("_", " ");
}
