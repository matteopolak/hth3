import {
  staffRequest,
  type TaxonomyDocument,
  type TaxonomyResponse,
} from "./client.js";
import type { StaffPageContext } from "./types.js";
import {
  button,
  date,
  empty,
  errorMessage,
  field,
  fieldValue,
  heading,
  node,
  setError,
  text,
} from "./ui.js";

export async function mountTaxonomy(context: StaffPageContext): Promise<void> {
  const { host, token, organizationId, locale } = context;
  let data: TaxonomyResponse;
  try {
    data = await staffRequest<TaxonomyResponse>(
      token,
      organizationId,
      "/taxonomy",
    );
  } catch (error) {
    host.replaceChildren(empty(errorMessage(error, locale)));
    return;
  }
  host.replaceChildren();
  const draft = data.draft;
  const published = data.published;
  const active = draft ?? published;
  const actions = node("div", "staff-actions");
  if (!draft && published)
    actions.append(
      button(
        text(locale, "Create draft", "Créer un brouillon"),
        () => void createDraft(),
      ),
    );
  if (draft)
    actions.append(
      button(
        text(locale, "Publish", "Publier"),
        () => void publish(),
        "staff-button",
      ),
    );
  host.append(heading(text(locale, "Taxonomy", "Taxonomie"), actions));
  if (!active) {
    host.append(
      empty(
        text(
          locale,
          "No taxonomy is available for this organization.",
          "Aucune taxonomie n’est disponible pour cette organisation.",
        ),
      ),
    );
    return;
  }
  const metadata = node(
    "p",
    "staff-muted",
    `${draft ? text(locale, "Draft", "Brouillon") : text(locale, "Published", "Publiée")} v${active.version} · ${date(active.publishedAt ?? active.createdAt, locale)}`,
  );
  host.append(metadata);
  const doc = structuredClone(active.document);
  const orderedGroups = [...doc.groups].sort((a, b) => a.order - b.order);
  const layout = node("div", "staff-taxonomy-layout");
  const navigation = node("nav", "staff-taxonomy-nav");
  navigation.setAttribute(
    "aria-label",
    text(locale, "Category groups", "Groupes de catégories"),
  );
  const categories = node("section", "staff-taxonomy-content");
  for (const group of orderedGroups) {
    const count = doc.categories.filter(
      (item) => item.groupId === group.id && !item.retired,
    ).length;
    const tab = button(
      group.name[locale],
      () => showGroup(group),
      "staff-taxonomy-tab",
    );
    tab.dataset.groupId = group.id;
    tab.append(node("span", "staff-taxonomy-count", String(count)));
    navigation.append(tab);
  }
  layout.append(navigation, categories);
  host.append(layout);
  if (orderedGroups[0]) showGroup(orderedGroups[0]);

  function showGroup(group: (typeof orderedGroups)[number]): void {
    for (const tab of navigation.querySelectorAll<HTMLElement>(
      ".staff-taxonomy-tab",
    ))
      tab.classList.toggle("is-selected", tab.dataset.groupId === group.id);
    categories.replaceChildren();
    const section = node("div", "staff-taxonomy-selected");
    const top = node("div", "staff-taxonomy-selected-head");
    top.append(node("h3", "", group.name[locale]));
    top.append(
      node(
        "span",
        "staff-muted",
        `${doc.categories.filter((item) => item.groupId === group.id && !item.retired).length} ${text(locale, "categories", "catégories")}`,
      ),
    );
    section.append(top);
    for (const category of doc.categories
      .filter((item) => item.groupId === group.id && !item.retired)
      .sort((a, b) => a.order - b.order)) {
      const details = node("details", "staff-category");
      details.append(node("summary", "", category.name[locale]));
      if (draft) {
        const english = field(
          text(locale, "English name", "Nom anglais"),
          category.name.en,
        );
        const french = field("Nom français", category.name.fr);
        const englishDescription = field(
          text(locale, "English description", "Description anglaise"),
          category.description.en,
          true,
        );
        const frenchDescription = field(
          "Description française",
          category.description.fr,
          true,
        );
        details.append(english, french, englishDescription, frenchDescription);
        details.append(
          button(
            text(locale, "Save category", "Enregistrer la catégorie"),
            () => {
              category.name.en = fieldValue(english);
              category.name.fr = fieldValue(french);
              category.description.en = fieldValue(englishDescription);
              category.description.fr = fieldValue(frenchDescription);
              void saveDocument(doc);
            },
          ),
        );
      } else
        details.append(node("p", "staff-muted", category.description[locale]));
      section.append(details);
    }
    categories.append(section);
  }
  if (draft) {
    const preview = node("section", "staff-section");
    preview.append(
      node("h3", "", text(locale, "Preview routing", "Aperçu du routage")),
    );
    const sample = field(
      text(locale, "Feedback text", "Texte du signalement"),
      "",
      true,
    );
    preview.append(
      sample,
      button(
        text(locale, "Compare", "Comparer"),
        () => void previewText(fieldValue(sample)),
        "staff-button secondary",
      ),
    );
    const result = node("div", "staff-preview-result");
    preview.append(result);
    host.append(preview);
    const advanced = node("details", "staff-section staff-advanced");
    advanced.append(
      node(
        "summary",
        "",
        text(
          locale,
          "Advanced document editing",
          "Modification avancée du document",
        ),
      ),
    );
    const editor = node("textarea", "staff-json-editor");
    editor.value = JSON.stringify(doc, null, 2);
    editor.setAttribute(
      "aria-label",
      text(locale, "Taxonomy JSON", "JSON de la taxonomie"),
    );
    advanced.append(
      editor,
      button(text(locale, "Save document", "Enregistrer le document"), () => {
        try {
          void saveDocument(JSON.parse(editor.value) as TaxonomyDocument);
        } catch {
          setError(
            host,
            text(locale, "Enter valid JSON.", "Saisissez un JSON valide."),
          );
        }
      }),
    );
    host.append(advanced);

    async function previewText(value: string): Promise<void> {
      if (!value) return;
      try {
        const comparison = await staffRequest<{
          current: { categoryId: string; intent: string; confidence: number };
          proposed: { categoryId: string; intent: string; confidence: number };
        }>(token, organizationId, "/taxonomy/preview", "POST", { text: value });
        result.replaceChildren(
          node(
            "p",
            "",
            `${text(locale, "Published", "Publiée")}: ${comparison.current.categoryId} · ${comparison.current.intent}`,
          ),
          node(
            "p",
            "",
            `${text(locale, "Draft", "Brouillon")}: ${comparison.proposed.categoryId} · ${comparison.proposed.intent}`,
          ),
        );
      } catch (error) {
        setError(host, errorMessage(error, locale));
      }
    }
  }

  async function createDraft(): Promise<void> {
    try {
      await staffRequest(token, organizationId, "/taxonomy/draft", "POST");
      await mountTaxonomy(context);
    } catch (error) {
      setError(host, errorMessage(error, locale));
    }
  }

  async function saveDocument(document: TaxonomyDocument): Promise<void> {
    try {
      await staffRequest(token, organizationId, "/taxonomy/draft", "PATCH", {
        document,
      });
      await mountTaxonomy(context);
    } catch (error) {
      setError(host, errorMessage(error, locale));
    }
  }

  async function publish(): Promise<void> {
    if (
      !window.confirm(
        text(
          locale,
          "Publish this taxonomy version?",
          "Publier cette version de la taxonomie?",
        ),
      )
    )
      return;
    try {
      await staffRequest(token, organizationId, "/taxonomy/publish", "POST");
      await mountTaxonomy(context);
    } catch (error) {
      setError(host, errorMessage(error, locale));
    }
  }
}
