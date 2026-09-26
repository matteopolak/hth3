import {
  staffRequest,
  type Theme,
  type ThemeCandidate,
  type ThemeCandidatesResponse,
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
  const candidatePanel = node("section", "staff-theme-review staff-section");
  let reviewButton: HTMLButtonElement | null = null;
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
    reviewButton = button(
      text(locale, "Review suggestions", "Examiner les suggestions"),
      () => void showCandidates(),
      "staff-button secondary",
    );
    const actions = node("div", "staff-actions");
    actions.append(
      reviewButton,
      button(
        text(locale, "Refresh", "Actualiser"),
        () => void refresh(),
        "staff-button secondary",
      ),
    );
    host.append(
      heading(
        text(locale, "Themes", "Thèmes"),
        actions,
      ),
    );
    host.append(
      node(
        "p",
        "staff-page-note",
        `${overview.themes.length} ${text(locale, "active themes · last 30 days", "thèmes actifs · 30 derniers jours")}`,
      ),
      candidatePanel,
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
    `${text(locale, "Updated", "Mis à jour")} ${date(overview.generatedAt, locale)} · ${text(locale, "Counts are submissions", "Les chiffres représentent les signalements")} · ${overview.analyticsAsOf ? `${text(locale, "Analytics synced", "Analytique synchronisée")} ${date(overview.analyticsAsOf, locale)}` : text(locale, "Analytics not synced yet", "Analytique non encore synchronisée")}${overview.analyticsPendingEvents ? ` · ${overview.analyticsPendingEvents} ${text(locale, "pending sync", "en attente de synchronisation")}` : ""}`,
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

  async function showCandidates(): Promise<void> {
    if (!reviewButton) return;
    reviewButton.disabled = true;
    candidatePanel.classList.add("is-visible");
    candidatePanel.replaceChildren(
      node(
        "p",
        "staff-muted",
        text(locale, "Checking for suggestions…", "Recherche de suggestions…"),
      ),
    );
    try {
      const result = await staffRequest<ThemeCandidatesResponse>(
        token,
        organizationId,
        "/themes/candidates",
        "POST",
      );
      const knownThemes = new Map(overview.themes.map((theme) => [theme.id, theme]));
      const missingIds = new Set(
        result.suggestions
          .flatMap((suggestion) => [
            suggestion.currentThemeId,
            suggestion.suggestedThemeId,
          ])
          .filter((id) => !knownThemes.has(id)),
      );
      await Promise.all(
        [...missingIds].map(async (id) => {
          try {
            const detail = await staffRequest<ThemeDetail>(
              token,
              organizationId,
              `/themes/${encodeURIComponent(id)}`,
            );
            knownThemes.set(id, detail.theme);
          } catch {
            // A missing theme cannot be reviewed safely; its action stays disabled.
          }
        }),
      );
      candidatePanel.replaceChildren(
        node(
          "h3",
          "",
          text(locale, "Suggestions for review", "Suggestions à examiner"),
        ),
        node(
          "p",
          "staff-muted",
          text(
            locale,
            "Open the linked submissions before moving one. Suggestions never change a theme automatically.",
            "Ouvrez les signalements liés avant d’en déplacer un. Les suggestions ne modifient jamais un thème automatiquement.",
          ),
        ),
      );
      if (!result.suggestions.length) {
        candidatePanel.append(
          empty(candidateEmptyMessage(result.groundingStatus, locale)),
        );
        return;
      }
      const list = node("div", "staff-theme-review-list");
      for (const suggestion of result.suggestions)
        list.append(candidateRow(suggestion, knownThemes, context));
      candidatePanel.append(list);
    } catch (error) {
      candidatePanel.replaceChildren(
        node("p", "staff-alert", errorMessage(error, locale)),
      );
    } finally {
      reviewButton.disabled = false;
    }
  }
}

function candidateEmptyMessage(
  status: ThemeCandidatesResponse["groundingStatus"],
  locale: StaffPageContext["locale"],
): string {
  if (status === "disabled")
    return text(
      locale,
      "Suggestions are unavailable for this organization.",
      "Les suggestions ne sont pas disponibles pour cette organisation.",
    );
  if (status === "capacity_limit")
    return text(
      locale,
      "Suggestions currently require 2–24 eligible submissions.",
      "Les suggestions exigent actuellement de 2 à 24 signalements admissibles.",
    );
  if (status === "provider_unavailable")
    return text(
      locale,
      "Suggestions could not be checked right now.",
      "Impossible de vérifier les suggestions pour le moment.",
    );
  return text(
    locale,
    "No suggested moves need review.",
    "Aucun déplacement suggéré à examiner.",
  );
}

function candidateRow(
  suggestion: ThemeCandidate,
  themes: Map<string, Theme>,
  context: StaffPageContext,
): HTMLElement {
  const { locale, token, organizationId, host } = context;
  const current = themes.get(suggestion.currentThemeId);
  const proposed = themes.get(suggestion.suggestedThemeId);
  const valid =
    suggestion.reviewRequired === true &&
    current?.categoryId === suggestion.categoryId &&
    proposed?.categoryId === suggestion.categoryId &&
    current.id !== proposed.id &&
    suggestion.sourceIds.includes(suggestion.submissionId);
  const item = node("article", "staff-theme-candidate");
  const change = node("div", "staff-theme-candidate-change");
  change.append(
    node("span", "", current?.title[locale] ?? text(locale, "Theme unavailable", "Thème indisponible")),
    node("span", "staff-theme-candidate-arrow", "→"),
    node("strong", "", proposed?.title[locale] ?? text(locale, "Theme unavailable", "Thème indisponible")),
  );
  item.append(change);
  const sources = node("div", "staff-theme-candidate-sources");
  const ids = [...new Set(suggestion.sourceIds)];
  ids.forEach((id) => {
    const link = button(
      id === suggestion.submissionId
        ? text(locale, "Review submission", "Examiner le signalement")
        : text(locale, "Compare submission", "Comparer le signalement"),
      () => context.onOpenFeedback?.(id),
      "staff-source-link",
    );
    link.disabled = !context.onOpenFeedback;
    link.title = id;
    sources.append(link);
  });
  item.append(sources);
  const footer = node("div", "staff-theme-candidate-footer");
  footer.append(
    node(
      "span",
      "staff-muted",
      Number.isFinite(suggestion.similarityScore)
        ? `${Math.round(suggestion.similarityScore * 100)}% ${text(locale, "similarity", "de similarité")}`
        : text(locale, "Similarity unavailable", "Similarité indisponible"),
    ),
  );
  const accept = button(
    text(locale, "Move to suggested theme", "Déplacer vers le thème suggéré"),
    () => void acceptSuggestion(),
    "staff-button",
  );
  accept.disabled = !valid;
  footer.append(accept);
  item.append(footer);
  if (!valid)
    item.append(
      node(
        "p",
        "staff-muted",
        text(
          locale,
          "Theme details changed. Refresh suggestions before reviewing this move.",
          "Les détails des thèmes ont changé. Actualisez les suggestions avant d’examiner ce déplacement.",
        ),
      ),
    );
  return item;

  async function acceptSuggestion(): Promise<void> {
    if (!valid) return;
    accept.disabled = true;
    try {
      await staffRequest(
        token,
        organizationId,
        `/themes/${encodeURIComponent(suggestion.suggestedThemeId)}/memberships`,
        "POST",
        { submissionId: suggestion.submissionId },
      );
      await mountThemes(context);
      host.prepend(
        node(
          "p",
          "staff-review-success",
          text(
            locale,
            "Submission moved to the suggested theme.",
            "Signalement déplacé vers le thème suggéré.",
          ),
        ),
      );
    } catch (error) {
      accept.disabled = false;
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
  if (theme.summaryEvidenceRestricted)
    card.append(
      node(
        "span",
        "staff-theme-summary-note",
        text(
          locale,
          "Summary limited for privacy",
          "Résumé limité pour protéger la vie privée",
        ),
      ),
    );
  if (theme.summaryStale)
    card.append(
      node(
        "span",
        "staff-theme-summary-note",
        text(locale, "Summary needs refresh", "Résumé à actualiser"),
      ),
    );
  const meta = node(
    "span",
    "staff-theme-delta",
    `${theme.change >= 0 ? "+" : ""}${theme.change} ${text(locale, "from prior", "depuis avant")}`,
  );
  card.append(meta);
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
    if (detail.theme.summaryGeneratedAt)
      panel.append(
        node(
          "p",
          "staff-muted",
          `${text(locale, "Summary updated", "Résumé mis à jour")} ${date(detail.theme.summaryGeneratedAt, locale)}`,
        ),
      );
    if (detail.theme.summaryEvidenceRestricted)
      panel.append(
        node(
          "p",
          "staff-muted",
          text(
            locale,
            "Summary uses category-level details to protect privacy. Authorized staff can review the linked submissions below.",
            "Le résumé utilise des détails par catégorie pour protéger la vie privée. Le personnel autorisé peut consulter les signalements liés ci-dessous.",
          ),
        ),
      );
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
