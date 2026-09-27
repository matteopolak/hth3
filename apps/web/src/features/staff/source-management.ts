import type { Locale } from "@civicresolve/contracts/v1";
import { StaffApiError } from "./client.js";
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
  text,
} from "./ui.js";

type EditableKey =
  | "name"
  | "publisher"
  | "sourceUrl"
  | "jurisdictionLevel"
  | "jurisdictionCode"
  | "jurisdictionName"
  | "municipalityCode"
  | "municipalityName"
  | "licenceName"
  | "licenceUrl"
  | "termsUrl";

interface Source {
  id: string;
  origin: string;
  name: string;
  publisher: string;
  sourceUrl: string;
  jurisdictionLevel: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  municipalityCode: string | null;
  municipalityName: string | null;
  licenceName: string | null;
  licenceUrl: string | null;
  termsUrl: string | null;
  termsStatus: string;
  collectionMode: string;
  fetchedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  freshnessState: string;
  lastError: string | null;
  sampleLabel: string | null;
  version: number;
  recordCount: number | null;
}

interface SourceRecord {
  id: string;
  externalId: string;
  title: string;
  sourceUrl: string;
  publisher: string;
  termsStatus: string;
  fetchedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  freshnessState: string;
  lastErrorCode: string | null;
  evidenceUrl: string | null;
  payloadHash: string | null;
  sampleLabel: string | null;
}

interface SourceChange {
  id: string;
  sourceId: string;
  sourceName?: string;
  baseSourceVersion: number;
  version: number;
  proposed: Partial<Record<EditableKey, string | null>> | null;
  reason: string;
  evidenceUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
}

const fields: Array<{
  key: EditableKey;
  en: string;
  fr: string;
  optional?: boolean;
  url?: boolean;
}> = [
  { key: "name", en: "Name", fr: "Nom" },
  { key: "publisher", en: "Publisher", fr: "Éditeur" },
  { key: "sourceUrl", en: "Source URL", fr: "URL de la source", url: true },
  {
    key: "jurisdictionLevel",
    en: "Jurisdiction level",
    fr: "Niveau de compétence",
  },
  {
    key: "jurisdictionCode",
    en: "Jurisdiction code",
    fr: "Code de compétence",
  },
  { key: "jurisdictionName", en: "Jurisdiction", fr: "Compétence" },
  {
    key: "municipalityCode",
    en: "Municipality code",
    fr: "Code municipal",
    optional: true,
  },
  {
    key: "municipalityName",
    en: "Municipality",
    fr: "Municipalité",
    optional: true,
  },
  { key: "licenceName", en: "Licence", fr: "Licence", optional: true },
  {
    key: "licenceUrl",
    en: "Licence URL",
    fr: "URL de la licence",
    optional: true,
    url: true,
  },
  {
    key: "termsUrl",
    en: "Terms URL",
    fr: "URL des conditions",
    optional: true,
    url: true,
  },
];

const apiBase = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

async function sourceRequest<T>(
  token: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${apiBase}/staff/sources${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok)
    throw new StaffApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      "SOURCE_REQUEST_FAILED",
    );
  if (!payload)
    throw new StaffApiError("Invalid response", 502, "BAD_RESPONSE");
  return payload;
}

function link(label: string, url: string): HTMLAnchorElement {
  const anchor = node("a", "staff-curator-link", label);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function sourceState(source: Source, locale: Locale): string {
  return `${stateLabel(source.freshnessState, locale)} · ${source.recordCount ?? 0} ${text(locale, "records", "dossiers")}`;
}

function stateLabel(value: string, locale: Locale): string {
  const labels: Record<string, [string, string]> = {
    current: ["Current", "À jour"],
    fresh: ["Fresh", "Récent"],
    stale: ["Stale", "Périmé"],
    expired: ["Expired", "Expiré"],
    error: ["Error", "Erreur"],
    unknown: ["Unknown", "Inconnu"],
    pending: ["Pending", "En attente"],
    approved: ["Approved", "Approuvée"],
    rejected: ["Rejected", "Rejetée"],
    approved_for_collection: ["Approved for collection", "Collecte approuvée"],
    link_only: ["Link only", "Lien seulement"],
    review_required: ["Review required", "Examen requis"],
  };
  return labels[value]?.[locale === "fr" ? 1 : 0] ?? value.replaceAll("_", " ");
}

export async function mountSources(
  context: StaffPageContext,
  preferredId?: string,
): Promise<void> {
  const { host, token, locale } = context;
  host.replaceChildren(
    heading(text(locale, "Sources", "Sources")),
    node("p", "staff-loading", text(locale, "Loading…", "Chargement…")),
  );
  let response: { sources: Source[]; pendingChanges: SourceChange[] };
  try {
    response = await sourceRequest(token, "");
  } catch (error) {
    host.replaceChildren(
      heading(text(locale, "Sources", "Sources")),
      empty(errorMessage(error, locale)),
    );
    return;
  }
  if (!host.isConnected) return;
  const { sources, pendingChanges } = response;
  host.replaceChildren(
    heading(text(locale, "Sources", "Sources")),
    node(
      "p",
      "staff-page-note",
      text(
        locale,
        `${sources.length} registered · ${pendingChanges.length} awaiting review`,
        `${sources.length} inscrites · ${pendingChanges.length} à examiner`,
      ),
    ),
  );
  if (pendingChanges.length) {
    const queue = node("section", "staff-curator-queue");
    queue.append(node("h3", "", text(locale, "Awaiting review", "À examiner")));
    const entries = node("div", "staff-curator-queue-list");
    for (const change of pendingChanges) {
      entries.append(
        button(
          `${change.sourceName ?? sources.find((source) => source.id === change.sourceId)?.name ?? change.sourceId} · ${date(change.createdAt, locale)}`,
          () => void showSource(change.sourceId),
          "staff-curator-queue-button",
        ),
      );
    }
    queue.append(entries);
    host.append(queue);
  }
  const collection = node("div", "staff-collection staff-curator-collection");
  const list = node("div", "staff-collection-list");
  if (!sources.length)
    list.append(
      empty(text(locale, "No sources registered.", "Aucune source inscrite.")),
    );
  for (const source of sources) {
    const item = node("article", "staff-list-row");
    item.dataset.id = source.id;
    item.append(
      button(
        source.name,
        () => void showSource(source.id),
        "staff-link-button",
      ),
    );
    item.append(
      node(
        "p",
        "staff-muted",
        `${source.jurisdictionName} · ${sourceState(source, locale)}`,
      ),
    );
    if (source.sampleLabel)
      item.append(
        node("span", "staff-curator-sample", text(locale, "Practice", "Essai")),
      );
    list.append(item);
  }
  collection.append(list);
  host.append(collection);
  const initial =
    sources.find((source) => source.id === preferredId) ?? sources[0];
  if (initial) void showSource(initial.id);

  async function showSource(sourceId: string): Promise<void> {
    for (const item of list.querySelectorAll<HTMLElement>(".staff-list-row"))
      item.classList.toggle("is-selected", item.dataset.id === sourceId);
    collection.querySelector(".staff-detail")?.remove();
    const panel = node("section", "staff-detail staff-curator-detail");
    panel.append(
      node(
        "p",
        "staff-loading",
        text(locale, "Loading source…", "Chargement de la source…"),
      ),
    );
    collection.append(panel);
    let detail: {
      source: Source;
      records: SourceRecord[];
      changes: SourceChange[];
    };
    try {
      detail = await sourceRequest(token, `/${encodeURIComponent(sourceId)}`);
    } catch (error) {
      panel.replaceChildren(empty(errorMessage(error, locale)));
      return;
    }
    if (!panel.isConnected) return;
    renderDetail(panel, detail);
  }

  function renderDetail(
    panel: HTMLElement,
    detail: {
      source: Source;
      records: SourceRecord[];
      changes: SourceChange[];
    },
  ): void {
    const { source, records, changes } = detail;
    const main = node("div", "staff-detail-main");
    const properties = node("aside", "staff-detail-properties");
    main.append(
      heading(
        source.name,
        link(text(locale, "Open source", "Ouvrir la source"), source.sourceUrl),
      ),
    );
    main.append(
      node(
        "p",
        "staff-curator-meta",
        `${source.publisher} · ${source.jurisdictionName}`,
      ),
    );
    if (source.sampleLabel)
      main.append(
        node(
          "p",
          "staff-curator-sample",
          text(
            locale,
            "Practice source · read only",
            "Source d’essai · lecture seule",
          ),
        ),
      );
    if (source.lastError)
      main.append(node("p", "staff-alert", source.lastError));
    main.append(
      node(
        "h3",
        "staff-curator-section-title",
        text(locale, "Records", "Dossiers"),
      ),
    );
    if (!records.length)
      main.append(
        empty(
          text(
            locale,
            "No records for this source.",
            "Aucun dossier pour cette source.",
          ),
        ),
      );
    const recordList = node("div", "staff-curator-records");
    for (const record of records) {
      const item = node("article", "staff-curator-record");
      const title = node("div", "staff-curator-record-title");
      title.append(
        node("strong", "", record.title),
        link(text(locale, "Source", "Source"), record.sourceUrl),
      );
      item.append(title);
      item.append(
        node(
          "p",
          "staff-muted",
          `${record.publisher} · ${stateLabel(record.freshnessState, locale)} · ${text(locale, "Verified", "Vérifié")} ${date(record.verifiedAt, locale)}`,
        ),
      );
      if (record.lastErrorCode)
        item.append(
          node(
            "p",
            "staff-curator-error",
            `${text(locale, "Error", "Erreur")}: ${record.lastErrorCode}`,
          ),
        );
      if (record.sampleLabel)
        item.append(
          node(
            "span",
            "staff-curator-sample",
            text(locale, "Practice", "Essai"),
          ),
        );
      const evidence = node("details", "staff-curator-record-evidence");
      evidence.append(
        node("summary", "", text(locale, "Provenance", "Provenance")),
      );
      evidence.append(
        row(
          text(locale, "Fetched", "Récupéré"),
          date(record.fetchedAt, locale),
        ),
        row(text(locale, "Expires", "Expire"), date(record.expiresAt, locale)),
        row(
          text(locale, "Terms", "Conditions"),
          stateLabel(record.termsStatus, locale),
        ),
        row(text(locale, "External ID", "ID externe"), record.externalId),
      );
      if (record.evidenceUrl)
        evidence.append(
          link(text(locale, "Evidence", "Preuve"), record.evidenceUrl),
        );
      if (record.payloadHash)
        evidence.append(
          row(
            text(locale, "Payload hash", "Empreinte du contenu"),
            record.payloadHash,
          ),
        );
      item.append(evidence);
      recordList.append(item);
    }
    main.append(recordList);
    main.append(
      node(
        "h3",
        "staff-curator-section-title",
        text(locale, "Change review", "Examen des modifications"),
      ),
    );
    if (!changes.length)
      main.append(
        empty(
          text(locale, "No changes proposed.", "Aucune modification proposée."),
        ),
      );
    for (const change of changes) main.append(changePanel(change, source));
    if (source.origin === "official_external")
      main.append(proposalForm(source));
    properties.append(
      node("h3", "", text(locale, "Source status", "État de la source")),
    );
    properties.append(
      row(
        text(locale, "Freshness", "Fraîcheur"),
        stateLabel(source.freshnessState, locale),
      ),
      row(
        text(locale, "Terms", "Conditions"),
        stateLabel(source.termsStatus, locale),
      ),
      row(
        text(locale, "Collection", "Collecte"),
        stateLabel(source.collectionMode, locale),
      ),
      row(
        text(locale, "Records", "Dossiers"),
        String(source.recordCount ?? records.length),
      ),
      row(text(locale, "Fetched", "Récupéré"), date(source.fetchedAt, locale)),
      row(text(locale, "Verified", "Vérifié"), date(source.verifiedAt, locale)),
      row(text(locale, "Expires", "Expire"), date(source.expiresAt, locale)),
      row(text(locale, "Version", "Version"), String(source.version)),
    );
    if (source.licenceName)
      properties.append(
        row(text(locale, "Licence", "Licence"), source.licenceName),
      );
    if (source.licenceUrl)
      properties.append(
        link(
          text(locale, "Licence details", "Détails de la licence"),
          source.licenceUrl,
        ),
      );
    if (source.termsUrl)
      properties.append(
        link(text(locale, "Terms", "Conditions"), source.termsUrl),
      );
    panel.replaceChildren(main, properties);
  }

  function changePanel(change: SourceChange, source: Source): HTMLElement {
    const card = node("article", "staff-curator-change");
    const top = node("div", "staff-curator-change-head");
    top.append(
      node("strong", "", stateLabel(change.status, locale)),
      node("span", "staff-muted", date(change.createdAt, locale)),
    );
    card.append(top, node("p", "staff-curator-reason", change.reason));
    card.append(link(text(locale, "Evidence", "Preuve"), change.evidenceUrl));
    if (change.proposed) {
      const comparison = node("div", "staff-curator-comparison");
      const labels = node(
        "div",
        "staff-curator-compare-row staff-curator-compare-labels",
      );
      labels.append(
        node("span", "", text(locale, "Field", "Champ")),
        node("span", "", text(locale, "Current", "Actuel")),
        node("span", "", text(locale, "Proposed", "Proposé")),
      );
      comparison.append(labels);
      for (const spec of fields) {
        if (!(spec.key in change.proposed)) continue;
        const pair = node("div", "staff-curator-compare-row");
        pair.append(
          node("span", "", text(locale, spec.en, spec.fr)),
          node("del", "", source[spec.key] ?? "—"),
          node("strong", "", change.proposed[spec.key] ?? "—"),
        );
        comparison.append(pair);
      }
      card.append(comparison);
    }
    if (change.reviewReason)
      card.append(
        node(
          "p",
          "staff-muted",
          `${text(locale, "Decision", "Décision")}: ${change.reviewReason}`,
        ),
      );
    if (change.status === "pending" && source.origin === "official_external") {
      const reason = field(
        text(locale, "Decision reason", "Motif de la décision"),
      );
      const input = reason.querySelector("input")!;
      input.minLength = 12;
      input.maxLength = 1200;
      card.append(reason);
      const actions = node("div", "staff-actions");
      for (const decision of ["approve", "reject"] as const) {
        const control = button(
          decision === "approve"
            ? text(locale, "Approve", "Approuver")
            : text(locale, "Reject", "Rejeter"),
          () => void decide(control, decision),
          decision === "approve" ? "staff-button" : "staff-button secondary",
        );
        actions.append(control);
        async function decide(
          control: HTMLButtonElement,
          value: "approve" | "reject",
        ): Promise<void> {
          const explanation = fieldValue(reason);
          if (explanation.length < 12) {
            setError(
              card,
              text(
                locale,
                "Add a reason of at least 12 characters.",
                "Ajoutez un motif d’au moins 12 caractères.",
              ),
            );
            return;
          }
          await performAction(control, card, locale, async () => {
            await sourceRequest(
              token,
              `/${encodeURIComponent(source.id)}/changes/${encodeURIComponent(change.id)}/decision`,
              {
                expectedVersion: change.version,
                decision: value,
                reason: explanation,
              },
            );
            await mountSources(context, source.id);
          });
        }
      }
      card.append(actions);
    }
    return card;
  }

  function proposalForm(source: Source): HTMLElement {
    const disclosure = node("details", "staff-curator-proposal");
    disclosure.append(
      node(
        "summary",
        "",
        text(
          locale,
          "Propose metadata correction",
          "Proposer une correction des métadonnées",
        ),
      ),
    );
    disclosure.append(
      node(
        "p",
        "staff-muted",
        text(
          locale,
          "Only changed fields are submitted. A curator must review the proposal before it takes effect. Publisher, URL, licence, and terms changes reset rights review to unreviewed.",
          "Seuls les champs modifiés sont envoyés. Une personne responsable doit examiner la proposition avant son application. Les changements d’éditeur, d’URL, de licence ou de conditions relancent l’examen des droits.",
        ),
      ),
    );
    const grid = node("div", "staff-curator-form-grid");
    const inputs = new Map<EditableKey, HTMLInputElement | HTMLSelectElement>();
    for (const spec of fields) {
      const wrapper = node("label", "staff-field");
      wrapper.append(
        node("span", "staff-field-label", text(locale, spec.en, spec.fr)),
      );
      let input: HTMLInputElement | HTMLSelectElement;
      if (spec.key === "jurisdictionLevel") {
        const select = node("select", "staff-select");
        for (const value of [
          "federal",
          "provincial",
          "municipal",
          "regional",
          "community",
        ]) {
          const option = node("option", "", stateLabel(value, locale));
          option.value = value;
          select.append(option);
        }
        input = select;
      } else {
        const entry = node("input");
        entry.type = spec.url ? "url" : "text";
        entry.maxLength = 500;
        input = entry;
      }
      input.value = source[spec.key] ?? "";
      inputs.set(spec.key, input);
      wrapper.append(input);
      grid.append(wrapper);
    }
    disclosure.append(grid);
    const reason = field(text(locale, "Reason", "Motif"), "", true);
    const reasonInput = reason.querySelector("textarea")!;
    reasonInput.minLength = 12;
    reasonInput.maxLength = 1200;
    const evidence = field(
      text(locale, "HTTPS evidence URL", "URL HTTPS de la preuve"),
    );
    evidence.querySelector("input")!.type = "url";
    const submit = button(
      text(locale, "Submit for review", "Soumettre à l’examen"),
      () => void propose(),
    );
    disclosure.append(reason, evidence, submit);
    async function propose(): Promise<void> {
      const changes: Partial<Record<EditableKey, string | null>> = {};
      for (const spec of fields) {
        const value = inputs.get(spec.key)!.value.trim();
        if (value === (source[spec.key] ?? "")) continue;
        changes[spec.key] = spec.optional && value === "" ? null : value;
      }
      const explanation = fieldValue(reason);
      const evidenceUrl = fieldValue(evidence);
      const municipalityCode = inputs.get("municipalityCode")!.value.trim();
      const municipalityName = inputs.get("municipalityName")!.value.trim();
      if (
        !Object.keys(changes).length ||
        explanation.length < 12 ||
        !isHttpsUrl(evidenceUrl)
      ) {
        setError(
          disclosure,
          text(
            locale,
            "Change a field, add a reason of at least 12 characters, and provide an HTTPS evidence URL.",
            "Modifiez un champ, ajoutez un motif d’au moins 12 caractères et fournissez une URL HTTPS de preuve.",
          ),
        );
        return;
      }
      if (
        Object.values(changes).some((value) => value === "") ||
        Boolean(municipalityCode) !== Boolean(municipalityName)
      ) {
        setError(
          disclosure,
          text(
            locale,
            "Complete required fields and municipality details together.",
            "Remplissez les champs obligatoires et les détails municipaux ensemble.",
          ),
        );
        return;
      }
      if (
        !municipalityCode &&
        !municipalityName &&
        ("municipalityCode" in changes || "municipalityName" in changes)
      ) {
        changes.municipalityCode = null;
        changes.municipalityName = null;
      }
      await performAction(submit, disclosure, locale, async () => {
        await sourceRequest(
          token,
          `/${encodeURIComponent(source.id)}/changes`,
          {
            expectedVersion: source.version,
            reason: explanation,
            evidenceUrl,
            changes,
          },
        );
        await mountSources(context, source.id);
      });
    }
    return disclosure;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
