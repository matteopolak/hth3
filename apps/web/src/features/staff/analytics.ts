import {
  StaffApiError,
  staffRequest,
  type AnalyticsResponse,
  type ThemesResponse,
} from "./client.js";
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
    host.replaceChildren(heading(text(locale, "Analytics", "Analytique")));
    if (
      error instanceof StaffApiError &&
      error.code === "ANALYTICS_UNAVAILABLE"
    ) {
      host.append(
        empty(
          text(
            locale,
            "Historical analytics are not connected. Current submission counts are shown below.",
            "L’analytique historique n’est pas connectée. Les totaux actuels figurent ci-dessous.",
          ),
        ),
      );
      try {
        const current = await staffRequest<ThemesResponse>(
          token,
          organizationId,
          "/themes?days=30",
        );
        const section = node("section", "staff-section");
        section.append(
          row(
            text(locale, "Submissions in 30 days", "Signalements en 30 jours"),
            String(current.totalSubmissions),
          ),
        );
        section.append(
          row(
            text(locale, "Awaiting response", "En attente de réponse"),
            String(current.unansweredSubmissions),
          ),
        );
        host.append(section);
      } catch {
        /* The original backend state remains visible. */
      }
    } else host.append(empty(errorMessage(error, locale)));
    return;
  }
  host.replaceChildren(heading(text(locale, "Analytics", "Analytique")));
  const metrics = node("div", "staff-metrics");
  const total = analytics.daily.reduce((sum, point) => sum + point.count, 0);
  metrics.append(
    metric(text(locale, "Submissions", "Signalements"), total),
    metric(
      text(locale, "Pending sync", "Synchronisation en attente"),
      analytics.pendingEvents,
    ),
  );
  host.append(metrics);
  host.append(
    node(
      "p",
      "staff-muted",
      `${text(locale, "Synchronized through", "Synchronisé jusqu’au")} ${date(analytics.synchronizedThrough, locale)}`,
    ),
  );
  const byCategory = node("section", "staff-section");
  byCategory.append(
    node("h3", "", text(locale, "By category", "Par catégorie")),
  );
  if (!analytics.categories.length)
    byCategory.append(
      empty(
        text(
          locale,
          "No synchronized submissions in this period.",
          "Aucun signalement synchronisé pendant cette période.",
        ),
      ),
    );
  for (const category of analytics.categories)
    byCategory.append(
      row(
        `${category.category} · ${category.intent}${category.sample ? ` · ${text(locale, "practice", "essai")}` : ""}`,
        String(category.count),
      ),
    );
  host.append(byCategory);
  const daily = node("section", "staff-section");
  daily.append(
    node("h3", "", text(locale, "Daily intake", "Signalements quotidiens")),
  );
  const grouped = new Map<string, number>();
  for (const point of analytics.daily)
    grouped.set(point.day, (grouped.get(point.day) ?? 0) + point.count);
  const peak = Math.max(1, ...grouped.values());
  const graph = node("div", "staff-bars");
  for (const [day, count] of grouped) {
    const bar = node("div", "staff-bar");
    bar.style.height = `${Math.max(3, (count / peak) * 100)}%`;
    bar.title = `${day}: ${count}`;
    graph.append(bar);
  }
  daily.append(graph);
  host.append(daily);
  const operations = node("section", "staff-section");
  operations.append(node("h3", "", text(locale, "Activity", "Activité")));
  for (const [event, count] of Object.entries(analytics.operational))
    operations.append(
      row(event.replaceAll("_", " ").replaceAll(".", " · "), String(count)),
    );
  if (!Object.keys(analytics.operational).length)
    operations.append(
      empty(
        text(
          locale,
          "No recorded activity in this period.",
          "Aucune activité enregistrée pendant cette période.",
        ),
      ),
    );
  host.append(operations);
}

function metric(label: string, value: number): HTMLElement {
  const item = node("div", "staff-metric");
  item.append(node("strong", "", String(value)), node("span", "", label));
  return item;
}
