import type { ApplicationStatus } from "@civicresolve/contracts/v1";
import {
  downloadStaffResume,
  staffRequest,
  type Application,
  type ApplicationMessage,
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
  row,
  setError,
  status,
  text,
} from "./ui.js";

const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["under_review"],
  under_review: ["information_requested", "shortlisted", "declined"],
  information_requested: ["under_review", "declined"],
  shortlisted: ["offer", "declined"],
  declined: [],
  offer: [],
};

export async function mountApplicants(
  context: StaffPageContext,
): Promise<void> {
  const { host, token, organizationId, locale } = context;
  let applications: Application[];
  try {
    ({ applications } = await staffRequest<{ applications: Application[] }>(
      token,
      organizationId,
      "/applications",
    ));
  } catch (error) {
    host.replaceChildren(empty(errorMessage(error, locale)));
    return;
  }
  host.replaceChildren(heading(text(locale, "Applicants", "Candidatures")));
  const list = node("div", "staff-list");
  if (!applications.length)
    list.append(
      empty(
        text(
          locale,
          "No applications yet.",
          "Aucune candidature pour le moment.",
        ),
      ),
    );
  for (const application of applications) {
    const item = node("article", "staff-list-row");
    item.append(
      button(
        application.postingTitle,
        () => void openApplication(application.id),
        "staff-link-button",
      ),
    );
    item.append(
      node(
        "p",
        "staff-muted",
        `${status(application.status, locale)} · ${date(application.submittedAt, locale)} · ${application.applicantSubject}`,
      ),
    );
    if (application.sample)
      item.append(
        node(
          "span",
          "staff-source-label",
          text(locale, "Practice application", "Candidature d’essai"),
        ),
      );
    list.append(item);
  }
  host.append(list);

  async function openApplication(id: string): Promise<void> {
    let application: Application;
    let messages: ApplicationMessage[];
    try {
      const [detail, conversation] = await Promise.all([
        staffRequest<{ application: Application }>(
          token,
          organizationId,
          `/applications/${encodeURIComponent(id)}`,
        ),
        staffRequest<{ messages: ApplicationMessage[] }>(
          token,
          organizationId,
          `/applications/${encodeURIComponent(id)}/messages`,
        ),
      ]);
      application = detail.application;
      messages = conversation.messages;
    } catch (error) {
      setError(host, errorMessage(error, locale));
      return;
    }
    host.querySelector(".staff-detail")?.remove();
    const panel = node("section", "staff-detail");
    const main = node("div", "staff-detail-main");
    const properties = node("aside", "staff-detail-properties");
    main.append(heading(application.postingTitle));
    const answers = node("section", "staff-answers");
    for (const [question, answer] of Object.entries(application.answers)) {
      const answerItem = node("div", "staff-answer");
      answerItem.append(node("strong", "", question), node("p", "", answer));
      answers.append(answerItem);
    }
    main.append(answers);
    const activity = node("section", "staff-activity");
    activity.append(node("h3", "", text(locale, "Activity", "Activité")));
    if (!messages.length)
      activity.append(
        empty(
          text(locale, "No messages yet.", "Aucun message pour le moment."),
        ),
      );
    for (const message of messages) {
      const entry = node("article", "staff-message");
      entry.append(
        node(
          "div",
          "staff-muted",
          `${message.author === "employer" ? text(locale, "Staff", "Personnel") : text(locale, "Applicant", "Candidat")} · ${date(message.createdAt, locale)}`,
        ),
      );
      entry.append(node("p", "", message.body));
      activity.append(entry);
    }
    const composer = node("form", "staff-message-composer");
    const messageInput = node("textarea");
    messageInput.rows = 3;
    messageInput.maxLength = 4000;
    messageInput.placeholder = text(
      locale,
      "Write a message…",
      "Rédiger un message…",
    );
    messageInput.setAttribute("aria-label", messageInput.placeholder);
    composer.append(
      messageInput,
      button(
        text(locale, "Send", "Envoyer"),
        () => void sendMessage(messageInput.value.trim()),
      ),
    );
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendMessage(messageInput.value.trim());
    });
    activity.append(composer);
    main.append(activity);

    properties.append(node("h3", "", text(locale, "Properties", "Propriétés")));
    properties.append(
      row(text(locale, "Status", "État"), status(application.status, locale)),
    );
    properties.append(
      row(text(locale, "Applicant", "Candidat"), application.applicantSubject),
    );
    properties.append(
      row(
        text(locale, "Submitted", "Soumise"),
        date(application.submittedAt, locale),
      ),
    );
    properties.append(
      button(
        text(locale, "Download shared résumé", "Télécharger le CV partagé"),
        () => void downloadResume(),
        "staff-button secondary",
      ),
    );
    const available = transitions[application.status];
    const decisionNote = field(
      text(
        locale,
        "Decision note (optional)",
        "Note de décision (facultative)",
      ),
      "",
      true,
    );
    if (available.length) {
      const group = node("div", "staff-decision-group");
      group.append(node("h3", "", text(locale, "Move to", "Passer à")));
      if (
        available.some(
          (next) =>
            next === "shortlisted" || next === "offer" || next === "declined",
        )
      )
        group.append(decisionNote);
      for (const next of available) {
        group.append(
          button(
            status(next, locale),
            () => void changeStatus(next),
            "staff-button secondary",
          ),
        );
      }
      properties.append(group);
    }
    if (application.sample)
      properties.append(
        node(
          "p",
          "staff-source-label",
          text(locale, "Practice application", "Candidature d’essai"),
        ),
      );
    panel.append(main, properties);
    host.append(panel);
    panel.scrollIntoView({ block: "nearest", behavior: "smooth" });

    async function sendMessage(message: string): Promise<void> {
      if (!message) return;
      try {
        await staffRequest(
          token,
          organizationId,
          `/applications/${encodeURIComponent(id)}/messages`,
          "POST",
          { message },
        );
        await openApplication(id);
      } catch (error) {
        setError(panel, errorMessage(error, locale));
      }
    }

    async function changeStatus(next: ApplicationStatus): Promise<void> {
      const isDecision =
        next === "shortlisted" || next === "offer" || next === "declined";
      if (
        !window.confirm(
          `${text(locale, "Change status to", "Changer l’état à")} ${status(next, locale)}?`,
        )
      )
        return;
      try {
        if (isDecision)
          await staffRequest(
            token,
            organizationId,
            `/applications/${encodeURIComponent(id)}/decision`,
            "POST",
            {
              status: next,
              ...(fieldValue(decisionNote)
                ? { message: fieldValue(decisionNote) }
                : {}),
            },
          );
        else
          await staffRequest(
            token,
            organizationId,
            `/applications/${encodeURIComponent(id)}/status`,
            "PATCH",
            { status: next },
          );
        await mountApplicants(context);
        await openApplication(id);
      } catch (error) {
        setError(panel, errorMessage(error, locale));
      }
    }

    async function downloadResume(): Promise<void> {
      try {
        await downloadStaffResume(token, organizationId, id);
      } catch (error) {
        if (error instanceof Error && "status" in error && error.status === 404)
          setError(
            panel,
            text(
              locale,
              "No résumé has been shared with this application.",
              "Aucun CV n’a été partagé avec cette candidature.",
            ),
          );
        else setError(panel, errorMessage(error, locale));
      }
    }
  }
}
