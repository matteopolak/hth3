import { staffRequest, type Posting } from "./client.js";
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
  performAction,
  row,
  setError,
  status,
  text,
} from "./ui.js";

export async function mountHiring(
  context: StaffPageContext,
  preferredId?: string,
): Promise<void> {
  const { host, token, organizationId, locale } = context;
  let postings: Posting[];
  try {
    ({ postings } = await staffRequest<{ postings: Posting[] }>(
      token,
      organizationId,
      "/postings",
    ));
  } catch (error) {
    host.replaceChildren(empty(errorMessage(error, locale)));
    return;
  }
  host.replaceChildren();
  const create = button(text(locale, "New posting", "Nouvelle offre"), () =>
    openEditor(),
  );
  host.append(heading(text(locale, "Hiring", "Recrutement"), create));
  host.append(
    node(
      "p",
      "staff-page-note",
      `${postings.length} ${postings.length === 1 ? text(locale, "posting", "offre") : text(locale, "postings", "offres")}`,
    ),
  );
  const collection = node("div", "staff-collection");
  const list = node("div", "staff-collection-list");
  if (!postings.length)
    list.append(
      empty(text(locale, "No postings yet.", "Aucune offre pour le moment.")),
    );
  for (const posting of postings) {
    const item = node("article", "staff-list-row");
    item.dataset.id = posting.id;
    item.append(
      button(posting.title, () => showPosting(posting), "staff-link-button"),
    );
    item.append(
      node(
        "p",
        "staff-muted",
        `${posting.location} · ${status(posting.status, locale)}`,
      ),
    );
    list.append(item);
  }
  collection.append(list);
  host.append(collection);
  const initial =
    postings.find((posting) => posting.id === preferredId) ?? postings[0];
  if (initial) showPosting(initial);

  function openEditor(posting?: Posting): void {
    collection.querySelector(".staff-detail")?.remove();
    selectPosting(posting?.id);
    const panel = node("section", "staff-detail");
    const main = node("div", "staff-detail-main");
    const properties = node("aside", "staff-detail-properties");
    main.append(
      heading(
        posting
          ? text(locale, "Edit posting", "Modifier l’offre")
          : text(locale, "New posting", "Nouvelle offre"),
      ),
    );
    const title = field(text(locale, "Title", "Titre"), posting?.title);
    const description = field(
      text(locale, "Description", "Description"),
      posting?.description,
      true,
    );
    const location = field(text(locale, "Location", "Lieu"), posting?.location);
    main.append(title, description, location);
    const controls = node("div", "staff-actions");
    const saveButton = button(
      text(locale, "Save", "Enregistrer"),
      () => void save(),
    );
    controls.append(saveButton);
    controls.append(
      button(
        text(locale, "Cancel", "Annuler"),
        () => panel.remove(),
        "staff-button secondary",
      ),
    );
    main.append(controls);
    if (posting) {
      properties.append(
        node("h3", "", text(locale, "Properties", "Propriétés")),
      );
      properties.append(
        row(text(locale, "Status", "État"), status(posting.status, locale)),
      );
      properties.append(
        row(
          text(locale, "Updated", "Mis à jour"),
          date(posting.updatedAt, locale),
        ),
      );
      if (posting.status === "draft")
        properties.append(transitionButton(posting, "publish", panel));
      if (posting.status === "published")
        properties.append(transitionButton(posting, "close", panel));
    }
    panel.append(main, properties);
    collection.append(panel);
    panel.scrollIntoView({ block: "nearest", behavior: "smooth" });

    async function save(): Promise<void> {
      const input = {
        title: fieldValue(title),
        description: fieldValue(description),
        location: fieldValue(location),
      };
      if (!input.title || !input.description || !input.location) {
        setError(
          panel,
          text(locale, "Complete all fields.", "Remplissez tous les champs."),
        );
        return;
      }
      await performAction(saveButton, panel, locale, async () => {
        const result = await staffRequest<{ posting: Posting }>(
          token,
          organizationId,
          posting ? `/postings/${encodeURIComponent(posting.id)}` : "/postings",
          posting ? "PATCH" : "POST",
          input,
        );
        await mountHiring(context, result.posting.id);
      });
    }
  }

  function showPosting(posting: Posting): void {
    collection.querySelector(".staff-detail")?.remove();
    selectPosting(posting.id);
    const panel = node("section", "staff-detail");
    const main = node("div", "staff-detail-main");
    main.append(
      heading(
        posting.title,
        button(
          text(locale, "Edit", "Modifier"),
          () => openEditor(posting),
          "staff-button secondary",
        ),
      ),
    );
    main.append(node("p", "staff-description", posting.description));
    const properties = node("aside", "staff-detail-properties");
    properties.append(node("h3", "", text(locale, "Properties", "Propriétés")));
    properties.append(
      row(text(locale, "Status", "État"), status(posting.status, locale)),
    );
    properties.append(row(text(locale, "Location", "Lieu"), posting.location));
    properties.append(
      row(text(locale, "Created", "Créée"), date(posting.createdAt, locale)),
    );
    properties.append(
      row(
        text(locale, "Published", "Publiée"),
        date(posting.publishedAt, locale),
      ),
    );
    if (posting.status === "draft")
      properties.append(transitionButton(posting, "publish", panel));
    if (posting.status === "published")
      properties.append(transitionButton(posting, "close", panel));
    if (posting.sample)
      properties.append(
        node(
          "p",
          "staff-source-label",
          text(locale, "Practice employer", "Employeur d’essai"),
        ),
      );
    panel.append(main, properties);
    collection.append(panel);
  }

  function selectPosting(id?: string): void {
    for (const item of collection.querySelectorAll<HTMLElement>(
      ".staff-list-row",
    ))
      item.classList.toggle("is-selected", item.dataset.id === id);
  }

  function transitionButton(
    posting: Posting,
    action: "publish" | "close",
    panel: HTMLElement,
  ): HTMLButtonElement {
    const control = button(
      action === "publish"
        ? text(locale, "Publish", "Publier")
        : text(locale, "Close posting", "Fermer l’offre"),
      () => void transition(posting, action, panel, control),
      action === "publish" ? "staff-button" : "staff-button secondary",
    );
    return control;
  }

  async function transition(
    posting: Posting,
    action: "publish" | "close",
    panel: HTMLElement,
    control: HTMLButtonElement,
  ): Promise<void> {
    if (
      !window.confirm(
        action === "publish"
          ? text(locale, "Publish this posting?", "Publier cette offre?")
          : text(locale, "Close this posting?", "Fermer cette offre?"),
      )
    )
      return;
    await performAction(control, panel, locale, async () => {
      await staffRequest(
        token,
        organizationId,
        `/postings/${encodeURIComponent(posting.id)}/${action}`,
        "POST",
      );
      await mountHiring(context, posting.id);
    });
  }
}
