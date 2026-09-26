import {
  staffRequest,
  type Theme,
  type ThemeDetail,
  type ThemesResponse,
} from "./client.js";
import type { StaffPageContext } from "./types.js";
import {
  button,
  date,
  empty,
  errorMessage,
  heading,
  node,
  row,
  setError,
  status,
  text,
} from "./ui.js";

export async function mountThemes(context: StaffPageContext): Promise<void> {
  const { host, token, organizationId, locale } = context;
  const view = context.view;
  const path = "/themes?days=30";
  let overview: ThemesResponse;
  try {
    overview = await staffRequest<ThemesResponse>(token, organizationId, path);
  } catch (error) {
    host.replaceChildren(empty(errorMessage(error, locale)));
    return;
  }
  host.replaceChildren();
  if (view === "overview") {
    host.append(heading(text(locale, "Overview", "Vue d’ensemble")));
    const top = node("div", "staff-overview-top");
    const lead = node("section", "staff-lead-stat");
    lead.append(
      node(
        "span",
        "staff-lead-label",
        text(locale, "Last 30 days", "30 derniers jours"),
      ),
      node("strong", "staff-lead-number", String(overview.totalSubmissions)),
      node(
        "span",
        "staff-lead-caption",
        text(locale, "submissions", "signalements"),
      ),
    );
    const split = node("div", "staff-lead-split");
    split.append(
      metric(
        text(locale, "Awaiting response", "En attente de réponse"),
        overview.unansweredSubmissions,
      ),
      metric(
        text(locale, "Prior period", "Période précédente"),
        overview.previousTotalSubmissions,
      ),
    );
    lead.append(split);
    top.append(lead, dailyChart(overview.daily, locale));
    host.append(top);
  } else {
    host.append(
      heading(
        text(locale, "Themes", "Thèmes"),
        button(
          text(locale, "Refresh", "Actualiser"),
          () => void refresh(),
          "staff-button secondary",
        ),
      ),
    );
    host.append(
      node(
        "p",
        "staff-page-note",
        `${overview.themes.length} ${text(locale, "active themes · last 30 days", "thèmes actifs · 30 derniers jours")}`,
      ),
    );
  }
  const lower =
    view === "overview" ? node("div", "staff-overview-lower") : host;
  const section = node(
    "section",
    view === "overview"
      ? "staff-section staff-themes-panel"
      : "staff-themes-page",
  );
  if (view === "overview")
    section.append(
      node("h3", "", text(locale, "Recurring themes", "Thèmes récurrents")),
    );
  if (!overview.themes.length)
    section.append(
      empty(text(locale, "No themes yet.", "Aucun thème pour le moment.")),
    );
  const themeList = node(
    "div",
    view === "overview" ? "staff-theme-list" : "staff-theme-grid",
  );
  for (const theme of overview.themes)
    themeList.append(themeRow(theme, context));
  section.append(themeList);
  lower.append(section);
  if (view === "overview") {
    const breakdown = node("section", "staff-section staff-status-panel");
    breakdown.append(node("h3", "", text(locale, "Status", "État")));
    for (const item of overview.statuses)
      breakdown.append(row(status(item.key, locale), String(item.count)));
    if (!overview.statuses.length)
      breakdown.append(
        empty(
          text(locale, "No activity yet.", "Aucune activité pour le moment."),
        ),
      );
    lower.append(breakdown);
    host.append(lower);
  }
  const asOf = node(
    "p",
    "staff-muted",
    `${text(locale, "Updated", "Mis à jour")} ${date(overview.generatedAt, locale)} · ${text(locale, "Counts are submissions", "Les chiffres représentent les signalements")}`,
  );
  host.append(asOf);

  async function refresh(): Promise<void> {
    try {
      await staffRequest(token, organizationId, "/themes/refresh", "POST");
      await mountThemes(context);
    } catch (error) {
      setError(host, errorMessage(error, locale));
    }
  }
}

function metric(label: string, value: number): HTMLElement {
  const item = node("div", "staff-metric");
  item.append(node("strong", "", String(value)), node("span", "", label));
  return item;
}

export function dailyChart(
  daily: ThemesResponse["daily"],
  locale: StaffPageContext["locale"],
): HTMLElement {
  const panel = node("section", "staff-trend-panel");
  panel.append(
    node("div", "staff-panel-kicker", text(locale, "Activity", "Activité")),
  );
  panel.append(
    node("h3", "", text(locale, "Daily intake", "Signalements quotidiens")),
  );
  const byDate = new Map(daily.map((point) => [point.day, point.count]));
  const graph = node("div", "staff-bars");
  const today = new Date();
  const values = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - 29 + index);
    const key = day.toISOString().slice(0, 10);
    return { key, count: byDate.get(key) ?? 0 };
  });
  const max = Math.max(1, ...values.map((item) => item.count));
  for (const item of values) {
    const bar = node("span", `staff-bar ${item.count ? "has-value" : ""}`);
    bar.style.height = `${Math.max(3, (item.count / max) * 100)}%`;
    bar.title = `${item.key}: ${item.count}`;
    graph.append(bar);
  }
  panel.append(graph);
  const footer = node("div", "staff-chart-footer");
  footer.append(
    node("span", "", text(locale, "30 days ago", "Il y a 30 jours")),
    node("span", "", text(locale, "Today", "Aujourd’hui")),
  );
  panel.append(footer);
  return panel;
}

function themeRow(theme: Theme, context: StaffPageContext): HTMLElement {
  const { locale, host, token, organizationId } = context;
  const card = node("article", "staff-theme-item");
  const open = button(
    theme.title[locale],
    () => void showTheme(),
    "staff-link-button",
  );
  const top = node("div", "staff-row-top");
  top.append(open, node("strong", "staff-theme-count", String(theme.count)));
  card.append(top);
  const summary = theme.summary[locale];
  if (summary) card.append(node("p", "staff-muted", summary));
  const meta = node(
    "span",
    "staff-theme-delta",
    `${theme.change >= 0 ? "+" : ""}${theme.change} ${text(locale, "from prior", "depuis avant")}`,
  );
  card.append(meta);
  if (theme.sample)
    card.append(
      node(
        "span",
        "staff-source-label",
        text(locale, "Practice records", "Données d’essai"),
      ),
    );
  return card;

  async function showTheme(): Promise<void> {
    card.classList.add("is-selected");
    let detail: ThemeDetail;
    try {
      detail = await staffRequest<ThemeDetail>(
        token,
        organizationId,
        `/themes/${encodeURIComponent(theme.id)}`,
      );
    } catch (error) {
      setError(host, errorMessage(error, locale));
      return;
    }
    host.querySelector(".staff-theme-detail")?.remove();
    const panel = node("section", "staff-theme-detail staff-section");
    const header = heading(
      theme.title[locale],
      button(
        text(locale, "Close", "Fermer"),
        () => panel.remove(),
        "staff-button secondary",
      ),
    );
    panel.append(header, node("p", "", detail.theme.summary[locale]));
    if (detail.theme.summaryStale)
      panel.append(
        node(
          "p",
          "staff-muted",
          text(
            locale,
            "Summary may be out of date.",
            "Le résumé pourrait être périmé.",
          ),
        ),
      );
    panel.append(
      row(
        text(locale, "Submissions", "Signalements"),
        String(detail.totalSubmissions),
      ),
    );
    const sources = node("div", "staff-source-list");
    for (const source of detail.sources) {
      const sourceButton = button(
        source.originalText,
        () => context.onOpenFeedback?.(source.id),
        "staff-source-link",
      );
      if (!context.onOpenFeedback) sourceButton.disabled = true;
      const line = node("div", "staff-source-row");
      line.append(
        sourceButton,
        node(
          "span",
          "staff-muted",
          `${date(source.createdAt, locale)} · ${status(source.status, locale)}`,
        ),
      );
      sources.append(line);
    }
    if (!detail.sources.length)
      sources.append(
        empty(text(locale, "No linked submissions.", "Aucun signalement lié.")),
      );
    panel.append(sources);
    host.append(panel);
    panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
