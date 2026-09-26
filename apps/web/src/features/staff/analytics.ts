import {
  StaffApiError,
  staffRequest,
  type AnalyticsResponse,
  type ThemesResponse,
} from "./client.js";
import { dailyChart } from "./themes.js";
import type { StaffPageContext } from "./types.js";
import { date, empty, errorMessage, heading, node, row, text } from "./ui.js";

export async function mountAnalytics(context: StaffPageContext): Promise<void> {
  const { host, token, organizationId, locale } = context;
  let analytics: AnalyticsResponse;
  try {
    analytics = await staffRequest<AnalyticsResponse>(
      token,
      organizationId,
      "/analytics?days=30",
    );
  } catch (error) {
    if (
      error instanceof StaffApiError &&
      error.code === "ANALYTICS_UNAVAILABLE"
    ) {
      await showCurrentIntake();
    } else
      host.replaceChildren(
        heading(text(locale, "Analytics", "Analytique")),
        empty(errorMessage(error, locale)),
      );
    return;
  }

  host.replaceChildren(heading(text(locale, "Analytics", "Analytique")));
  const total = analytics.daily.reduce((sum, item) => sum + item.count, 0);
  const top = node("div", "staff-overview-top");
  const lead = leadStat(
    total,
    text(locale, "synchronized submissions", "signalements synchronisés"),
    text(locale, "Last 30 days", "30 derniers jours"),
  );
  const split = node("div", "staff-lead-split");
  split.append(
    metric(text(locale, "Pending sync", "En attente"), analytics.pendingEvents),
  );
  lead.append(split);
  const daily = new Map<string, number>();
  for (const item of analytics.daily)
    daily.set(item.day, (daily.get(item.day) ?? 0) + item.count);
  top.append(
    lead,
    dailyChart(
      [...daily].map(([day, count]) => ({ day, count })),
      locale,
    ),
  );
  host.append(top);
  const lower = node("div", "staff-overview-lower");
  const categories = node("section", "staff-section staff-themes-panel");
  categories.append(node("h3", "", text(locale, "Categories", "Catégories")));
  if (!analytics.categories.length)
    categories.append(
      empty(
        text(
          locale,
          "No synchronized intake yet.",
          "Aucun signalement synchronisé.",
        ),
      ),
    );
  for (const category of analytics.categories)
    categories.append(
      row(
        `${category.category} · ${category.intent}${category.sample ? ` · ${text(locale, "practice", "essai")}` : ""}`,
        String(category.count),
      ),
    );
  const operations = node("section", "staff-section staff-status-panel");
  operations.append(node("h3", "", text(locale, "Activity", "Activité")));
  if (!Object.keys(analytics.operational).length)
    operations.append(
      empty(text(locale, "No activity yet.", "Aucune activité.")),
    );
  for (const [event, count] of Object.entries(analytics.operational))
    operations.append(
      row(event.replaceAll("_", " ").replaceAll(".", " · "), String(count)),
    );
  lower.append(categories, operations);
  host.append(
    lower,
    node(
      "p",
      "staff-data-note",
      `${text(locale, "Synchronized through", "Synchronisé jusqu’au")} ${date(analytics.synchronizedThrough, locale)}`,
    ),
  );

  async function showCurrentIntake(): Promise<void> {
    host.replaceChildren(heading(text(locale, "Analytics", "Analytique")));
    let current: ThemesResponse;
    try {
      current = await staffRequest<ThemesResponse>(
        token,
        organizationId,
        "/themes?days=30",
      );
    } catch {
      host.append(
        empty(
          text(
            locale,
            "Intake is temporarily unavailable.",
            "Les données sont temporairement indisponibles.",
          ),
        ),
      );
      return;
    }
    host.append(
      node(
        "p",
        "staff-connection-note",
        text(
          locale,
          "Historical sync unavailable · current intake shown",
          "Synchronisation historique indisponible · données actuelles affichées",
        ),
      ),
    );
    const top = node("div", "staff-overview-top");
    const lead = leadStat(
      current.totalSubmissions,
      text(locale, "submissions", "signalements"),
      text(locale, "Last 30 days", "30 derniers jours"),
    );
    const split = node("div", "staff-lead-split");
    split.append(
      metric(
        text(locale, "Awaiting response", "En attente de réponse"),
        current.unansweredSubmissions,
      ),
    );
    lead.append(split);
    top.append(lead, dailyChart(current.daily, locale));
    host.append(top);
    const lower = node("div", "staff-overview-lower");
    const categories = node("section", "staff-section staff-themes-panel");
    categories.append(node("h3", "", text(locale, "Categories", "Catégories")));
    if (!current.categories.length)
      categories.append(
        empty(text(locale, "No submissions yet.", "Aucun signalement.")),
      );
    for (const item of current.categories)
      categories.append(row(item.key.replaceAll("_", " "), String(item.count)));
    const statuses = node("section", "staff-section staff-status-panel");
    statuses.append(node("h3", "", text(locale, "Status", "État")));
    for (const item of current.statuses)
      statuses.append(row(item.key.replaceAll("_", " "), String(item.count)));
    lower.append(categories, statuses);
    host.append(
      lower,
      node(
        "p",
        "staff-data-note",
        text(
          locale,
          "Live counts from the feedback queue",
          "Totaux actuels de la file des signalements",
        ),
      ),
    );
  }
}

function leadStat(value: number, caption: string, period: string): HTMLElement {
  const lead = node("section", "staff-lead-stat");
  lead.append(
    node("span", "staff-lead-label", period),
    node("strong", "staff-lead-number", String(value)),
    node("span", "staff-lead-caption", caption),
  );
  return lead;
}

function metric(label: string, value: number): HTMLElement {
  const item = node("div", "staff-metric");
  item.append(node("strong", "", String(value)), node("span", "", label));
  return item;
}
