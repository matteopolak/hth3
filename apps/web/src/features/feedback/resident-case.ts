import type { Locale } from "@civicresolve/contracts/v1";
import type { FeedbackClientReceipt } from "../../platform/api.js";

interface Options {
  receipt: FeedbackClientReceipt;
  locale: Locale;
  error: string;
  busy: boolean;
  onRefresh: () => void;
  onReply: (message: string) => void;
  onReopen: (message: string) => void;
  onNew: () => void;
}

const copy = {
  en: {
    activity: "Activity",
    noActivity: "No updates yet.",
    status: "Status",
    destination: "Destination",
    municipality: "Municipality",
    department: "Department",
    outcome: "Outcome",
    original: "Your report",
    improvement: "What would improve this",
    team: "Team response",
    you: "You",
    refresh: "Refresh status",
    reply: "Add a follow-up",
    replyHint: "Add information for the review team",
    send: "Send follow-up",
    reopen: "Reopen with new information",
    reopenHint: "Describe what changed or what remains unresolved",
    reopenAction: "Reopen case",
    newReport: "Write another report",
    private: "This receipt is private. Keep its secret token on this device.",
    statuses: {
      submitted: "Submitted",
      acknowledged: "Acknowledged",
      in_review: "In review",
      waiting_on_resident: "Waiting on you",
      outcome_recorded: "Outcome recorded",
      closed: "Closed",
      reopened: "Reopened",
    },
  },
  fr: {
    activity: "Activité",
    noActivity: "Aucune mise à jour pour le moment.",
    status: "État",
    destination: "Destination",
    municipality: "Municipalité",
    department: "Service",
    outcome: "Résultat",
    original: "Votre signalement",
    improvement: "Ce qui améliorerait la situation",
    team: "Réponse de l’équipe",
    you: "Vous",
    refresh: "Actualiser l’état",
    reply: "Ajouter un suivi",
    replyHint: "Ajoutez des renseignements pour l’équipe",
    send: "Envoyer le suivi",
    reopen: "Rouvrir avec de nouveaux renseignements",
    reopenHint: "Décrivez ce qui a changé ou ce qui n’est pas résolu",
    reopenAction: "Rouvrir le dossier",
    newReport: "Rédiger un autre signalement",
    private: "Ce reçu est privé. Gardez son jeton secret sur cet appareil.",
    statuses: {
      submitted: "Soumis",
      acknowledged: "Reçu",
      in_review: "À l’étude",
      waiting_on_resident: "En attente de vous",
      outcome_recorded: "Résultat consigné",
      closed: "Fermé",
      reopened: "Rouvert",
    },
  },
} as const;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function date(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function createResidentFeedbackCase(options: Options): HTMLElement {
  const { receipt, locale } = options;
  const text = copy[locale];
  const root = element("section", "resident-case");
  const main = element("div", "resident-case-main");
  const header = element("header", "resident-case-header");
  const key = element("span", "resident-case-key", receipt.id);
  const heading = element(
    "h2",
    "",
    (receipt.originalText.split(/[\n.!?]/)[0]?.trim() || text.original).slice(
      0,
      120,
    ),
  );
  header.append(key, heading, element("p", "", receipt.originalText));
  if (receipt.constructiveFollowUp)
    header.append(
      element(
        "p",
        "resident-case-improvement",
        `${text.improvement}: ${receipt.constructiveFollowUp}`,
      ),
    );
  main.append(header);

  const activity = element("section", "resident-case-activity");
  const activityHead = element("div", "resident-case-activity-head");
  activityHead.append(element("h3", "", text.activity));
  const refresh = element("button", "resident-case-quiet", text.refresh);
  refresh.type = "button";
  refresh.disabled = options.busy;
  refresh.addEventListener("click", options.onRefresh);
  activityHead.append(refresh);
  activity.append(activityHead);
  if (options.error)
    activity.append(element("p", "resident-case-error", options.error));
  const thread = element("div", "resident-case-thread");
  for (const message of receipt.messages) {
    if (message.author === "resident" && message.body === receipt.originalText)
      continue;
    const item = element("article", "resident-case-message");
    const byline = element("div", "resident-case-message-meta");
    byline.append(
      element("strong", "", message.author === "staff" ? text.team : text.you),
      element("time", "", date(message.createdAt, locale)),
    );
    item.append(byline, element("p", "", message.body));
    thread.append(item);
  }
  if (!thread.childElementCount)
    thread.append(element("p", "resident-case-muted", text.noActivity));
  activity.append(thread);

  const mayReopen =
    receipt.status === "closed" || receipt.status === "outcome_recorded";
  const form = element("form", "resident-case-compose");
  const label = element("label", "", mayReopen ? text.reopen : text.reply);
  const input = element("textarea", "");
  input.rows = 3;
  input.maxLength = 5000;
  input.placeholder = mayReopen ? text.reopenHint : text.replyHint;
  input.required = true;
  label.append(input);
  const send = element(
    "button",
    "resident-case-primary",
    mayReopen ? text.reopenAction : text.send,
  );
  send.type = "submit";
  send.disabled = options.busy;
  form.append(label, send);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    if (mayReopen) options.onReopen(message);
    else options.onReply(message);
  });
  activity.append(form);
  main.append(activity);

  const properties = element("aside", "resident-case-properties");
  const status = element(
    "span",
    "resident-case-status",
    text.statuses[receipt.status],
  );
  properties.append(element("h3", "resident-case-properties-title", text.status), status);
  const facts: Array<[string, string | null | undefined]> = [
    [text.destination, receipt.destinationLabel],
    [text.municipality, receipt.municipality?.name],
    [text.department, receipt.departmentName],
  ];
  for (const [labelText, value] of facts) {
    if (!value) continue;
    const row = element("div", "resident-case-property");
    row.append(element("span", "", labelText), element("strong", "", value));
    properties.append(row);
  }
  if (receipt.outcome) {
    const outcome = element("div", "resident-case-property");
    outcome.append(
      element("span", "", text.outcome),
      element("p", "", receipt.outcome),
    );
    properties.append(outcome);
  }
  properties.append(element("p", "resident-case-muted", text.private));
  const again = element("button", "resident-case-quiet", text.newReport);
  again.type = "button";
  again.addEventListener("click", options.onNew);
  properties.append(again);
  root.append(main, properties);
  return root;
}
