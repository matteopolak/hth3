import type { FeedbackStatus, Locale } from "@civicresolve/contracts/v1";
import { staffRequest } from "./client.js";
import { button, errorMessage, node, setError, text } from "./ui.js";

export interface StaffFeedbackOperationsOptions {
  token: string;
  organizationId: string;
  locale: Locale;
  submission: {
    id: string;
    status: FeedbackStatus;
    assignment?:
      | {
          departmentId: string;
          departmentName: string;
          assigneeSubject: string | null;
        }
      | null
      | undefined;
  };
  onChanged: () => void | Promise<void>;
}

interface AssignmentOptions {
  departments: Array<{
    id: string;
    nameEn: string;
    nameFr: string;
    jurisdictionLevel: string;
  }>;
  assignees: Array<{ subject: string; roles: string[] }>;
}

export function staffFeedbackOperations(
  options: StaffFeedbackOperationsOptions,
): HTMLElement {
  const { token, organizationId, locale, submission, onChanged } = options;
  const host = node("section", "staff-feedback-operations");
  host.append(node("h3", "", text(locale, "Routing", "Affectation")));
  const routing = node("div", "staff-routing-controls");
  routing.append(
    node(
      "p",
      "staff-muted",
      text(locale, "Loading routing…", "Chargement de l’affectation…"),
    ),
  );
  host.append(routing);
  void loadRouting();

  if (submission.status === "in_review") {
    const actions = node("div", "staff-feedback-transitions");
    actions.append(
      disclosure(
        text(locale, "Request details", "Demander des précisions"),
        text(
          locale,
          "What information is needed?",
          "Quels renseignements sont nécessaires?",
        ),
        "request-details",
        "message",
      ),
      disclosure(
        text(locale, "Record outcome", "Consigner le résultat"),
        text(
          locale,
          "What action was taken or planned?",
          "Quelle action a été prise ou prévue?",
        ),
        "outcome",
        "summary",
      ),
    );
    host.append(actions);
  }
  return host;

  async function loadRouting(): Promise<void> {
    let choices: AssignmentOptions;
    try {
      choices = await staffRequest<AssignmentOptions>(
        token,
        organizationId,
        "/feedback/assignment-options",
      );
    } catch (error) {
      routing.replaceChildren(
        node("p", "staff-muted", errorMessage(error, locale)),
      );
      return;
    }
    routing.replaceChildren();
    const department = node("select", "staff-select");
    department.setAttribute(
      "aria-label",
      text(locale, "Department", "Service"),
    );
    const emptyDepartment = node(
      "option",
      "",
      text(locale, "Choose department", "Choisir un service"),
    );
    emptyDepartment.value = "";
    department.append(emptyDepartment);
    for (const item of choices.departments) {
      const option = node(
        "option",
        "",
        locale === "fr" ? item.nameFr : item.nameEn,
      );
      option.value = item.id;
      department.append(option);
    }
    department.value = submission.assignment?.departmentId ?? "";
    const assignee = node("select", "staff-select");
    assignee.setAttribute(
      "aria-label",
      text(locale, "Assigned to", "Responsable"),
    );
    const unassigned = node(
      "option",
      "",
      text(locale, "Unassigned", "Non attribué"),
    );
    unassigned.value = "";
    assignee.append(unassigned);
    for (const member of choices.assignees) {
      const tail = member.subject.split("|").at(-1) ?? member.subject;
      const label =
        tail.length > 24 ? `${tail.slice(0, 8)}…${tail.slice(-6)}` : tail;
      const option = node("option", "", label);
      option.value = member.subject;
      option.title = member.subject;
      assignee.append(option);
    }
    assignee.value = submission.assignment?.assigneeSubject ?? "";
    const departmentField = node("label", "staff-control-field");
    departmentField.append(
      node("span", "", text(locale, "Department", "Service")),
      department,
    );
    const memberField = node("label", "staff-control-field");
    memberField.append(
      node("span", "", text(locale, "Assigned to", "Responsable")),
      assignee,
    );
    const save = button(
      text(locale, "Save routing", "Enregistrer l’affectation"),
      () => void saveAssignment(),
      "staff-button secondary",
    );
    routing.append(departmentField, memberField, save);

    async function saveAssignment(): Promise<void> {
      if (!department.value) {
        setError(
          host,
          text(locale, "Choose a department.", "Choisissez un service."),
        );
        return;
      }
      save.disabled = true;
      try {
        await staffRequest(
          token,
          organizationId,
          `/feedback/${encodeURIComponent(submission.id)}/assignment`,
          "PATCH",
          {
            departmentId: department.value,
            assigneeSubject: assignee.value || null,
          },
        );
        await onChanged();
      } catch (error) {
        setError(host, errorMessage(error, locale));
        save.disabled = false;
      }
    }
  }

  function disclosure(
    label: string,
    placeholder: string,
    route: "request-details" | "outcome",
    field: "message" | "summary",
  ): HTMLElement {
    const details = node("details", "staff-action-disclosure");
    details.append(node("summary", "", label));
    const form = node("form", "staff-action-form");
    const input = node("textarea");
    input.rows = 3;
    input.maxLength = route === "outcome" ? 2000 : 5000;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    const submit = button(label, () => void save(), "staff-button");
    form.append(input, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void save();
    });
    details.append(form);
    return details;

    async function save(): Promise<void> {
      const value = input.value.trim();
      if (!value) return;
      submit.disabled = true;
      try {
        await staffRequest(
          token,
          organizationId,
          `/feedback/${encodeURIComponent(submission.id)}/${route}`,
          "POST",
          { [field]: value },
        );
        await onChanged();
      } catch (error) {
        setError(host, errorMessage(error, locale));
        submit.disabled = false;
      }
    }
  }
}
