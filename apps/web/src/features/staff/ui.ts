import type { Locale } from "@civicresolve/contracts/v1";

export function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  content?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

export function button(
  label: string,
  onClick: () => void,
  className = "staff-button",
): HTMLButtonElement {
  const element = node("button", className, label);
  element.type = "button";
  element.addEventListener("click", onClick);
  return element;
}

export function field(
  label: string,
  value = "",
  multiline = false,
): HTMLLabelElement {
  const wrapper = node("label", "staff-field");
  wrapper.append(node("span", "staff-field-label", label));
  const input = multiline ? node("textarea") : node("input");
  input.value = value;
  if (input instanceof HTMLTextAreaElement) input.rows = 5;
  wrapper.append(input);
  return wrapper;
}

export function fieldValue(wrapper: HTMLLabelElement): string {
  return (
    wrapper.querySelector("input, textarea") as
      | HTMLInputElement
      | HTMLTextAreaElement
  ).value.trim();
}

export function heading(title: string, action?: HTMLElement): HTMLElement {
  const row = node("div", "staff-heading");
  row.append(node("h2", "", title));
  if (action) row.append(action);
  return row;
}

export function empty(message: string): HTMLElement {
  return node("p", "staff-empty", message);
}

export function row(label: string, value: string): HTMLElement {
  const item = node("div", "staff-property");
  item.append(node("span", "", label), node("strong", "", value));
  return item;
}

export function text(locale: Locale, en: string, fr: string): string {
  return locale === "fr" ? fr : en;
}

export function date(value: string | null, locale: Locale): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error) {
    if (error.message === "Failed to fetch")
      return text(locale, "Connection unavailable.", "Connexion indisponible.");
    return error.message;
  }
  return text(locale, "Something went wrong.", "Une erreur s’est produite.");
}

export function setError(host: HTMLElement, message: string): void {
  host.querySelector(".staff-alert")?.remove();
  host.prepend(node("p", "staff-alert", message));
}

export function status(value: string, locale: Locale = "en"): string {
  if (locale === "fr") {
    const translated: Record<string, string> = {
      draft: "brouillon",
      published: "publiée",
      closed: "fermée",
      submitted: "soumise",
      under_review: "en examen",
      information_requested: "renseignements demandés",
      shortlisted: "présélectionnée",
      declined: "refusée",
      offer: "offre",
      acknowledged: "accusé de réception",
      in_review: "en examen",
      waiting_on_resident: "en attente du résident",
      outcome_recorded: "résultat consigné",
      reopened: "rouverte",
    };
    return translated[value] ?? value.replaceAll("_", " ");
  }
  return value.replaceAll("_", " ");
}
