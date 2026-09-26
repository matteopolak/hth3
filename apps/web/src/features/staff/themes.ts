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
    const metrics = node("div", "staff-metrics");
    metrics.append(
      metric(
        text(locale, "Submissions", "Signalements"),
        overview.totalSubmissions,
      ),
      metric(
        text(locale, "Awaiting response", "En attente de réponse"),
        overview.unansweredSubmissions,
      ),
      metric(
        text(locale, "Previous 30 days", "30 jours précédents"),
        overview.previousTotalSubmissions,
      ),
    );
    host.append(heading(text(locale, "Overview", "Vue d’ensemble")), metrics);
    if (overview.daily.length) {
      const chart = node("section", "staff-section");
      chart.append(
        node(
          "h3",
          "",
          text(locale, "Daily submissions", "Signalements quotidiens"),
        ),
      );
      const graph = node("div", "staff-bars");
      const maximum = Math.max(
        1,
        ...overview.daily.map((point) => point.count),
      );
      for (const point of overview.daily) {
        const bar = node("div", "staff-bar");
        bar.style.height = `${Math.max(3, (point.count / maximum) * 100)}%`;
        bar.title = `${point.day}: ${point.count}`;
        graph.append(bar);
      }
      chart.append(graph);
      host.append(chart);
    }
    if (overview.statuses.length) {
      const breakdown = node("section", "staff-section");
      breakdown.append(node("h3", "", text(locale, "By status", "Par état")));
      for (const item of overview.statuses)
        breakdown.append(row(status(item.key, locale), String(item.count)));
      host.append(breakdown);
    }
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
  }
  const section = node("section", "staff-section");
  if (view === "overview")
    section.append(
      node("h3", "", text(locale, "Recurring themes", "Thèmes récurrents")),
    );
  if (!overview.themes.length)
    section.append(
      empty(text(locale, "No themes yet.", "Aucun thème pour le moment.")),
    );
  for (const theme of overview.themes) section.append(themeRow(theme, context));
  host.append(section);
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

function themeRow(theme: Theme, context: StaffPageContext): HTMLElement {
  const { locale, host, token, organizationId } = context;
  const card = node("article", "staff-list-row");
  const open = button(
    theme.title[locale],
    () => void showTheme(),
    "staff-link-button",
  );
  const top = node("div", "staff-row-top");
  top.append(open, node("span", "staff-count", String(theme.count)));
  card.append(top);
  const summary = theme.summary[locale];
  if (summary) card.append(node("p", "staff-muted", summary));
  const meta = node(
    "span",
    "staff-muted",
    `${theme.change >= 0 ? "+" : ""}${theme.change} ${text(locale, "vs prior period", "par rapport à la période précédente")}`,
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
