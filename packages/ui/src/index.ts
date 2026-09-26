export type ButtonVariant = "primary" | "secondary" | "quiet" | "link";
export type StatusTone = "neutral" | "success" | "warning" | "danger";
let nextFieldId = 0;

export function uiButton(
  label: string,
  onClick: () => void,
  options: {
    variant?: ButtonVariant;
    className?: string;
    ariaLabel?: string;
  } = {},
): HTMLButtonElement {
  const button = document.createElement("button");
  const variant = options.variant ?? "secondary";
  button.type = "button";
  button.className = `ui-button ui-button--${variant}${options.className ? ` ${options.className}` : ""}`;
  button.textContent = label;
  if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);
  if (!label && !options.ariaLabel)
    throw new Error("uiButton requires a visible or accessible label");
  button.addEventListener("click", onClick);
  return button;
}

export function uiCard(
  children: Node | string | Array<Node | string>,
  options: { className?: string; ariaLabel?: string } = {},
): HTMLElement {
  const card = document.createElement("section");
  card.className = `ui-card${options.className ? ` ${options.className}` : ""}`;
  if (options.ariaLabel) card.setAttribute("aria-label", options.ariaLabel);
  card.append(...(Array.isArray(children) ? children : [children]));
  return card;
}

export function uiField<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
>(
  label: string,
  control: T,
  options: {
    className?: string;
    captionClassName?: string;
    hint?: string;
    error?: string;
  } = {},
): HTMLLabelElement {
  const field = document.createElement("label");
  field.className = `ui-field${options.className ? ` ${options.className}` : ""}`;
  const caption = document.createElement("span");
  caption.className = `ui-field__caption${options.captionClassName ? ` ${options.captionClassName}` : ""}`;
  caption.textContent = label;
  field.append(caption, control);

  const descriptors: string[] = [];
  if ((options.hint || options.error) && !control.id)
    control.id = `ui-field-${++nextFieldId}`;
  for (const [kind, message] of [
    ["hint", options.hint],
    ["error", options.error],
  ] as const) {
    if (!message) continue;
    const detail = document.createElement("span");
    detail.className = `ui-field__${kind}`;
    detail.id = `${control.id || "ui-field"}-${kind}`;
    detail.textContent = message;
    field.append(detail);
    descriptors.push(detail.id);
  }
  if (descriptors.length) {
    const existing = control.getAttribute("aria-describedby");
    control.setAttribute(
      "aria-describedby",
      [existing, ...descriptors].filter(Boolean).join(" "),
    );
  }
  if (options.error) control.setAttribute("aria-invalid", "true");
  return field;
}

export function uiStatus(
  label: string,
  options: { tone?: StatusTone; className?: string } = {},
): HTMLSpanElement {
  const status = document.createElement("span");
  status.className = `ui-status ui-status--${options.tone ?? "neutral"}${options.className ? ` ${options.className}` : ""}`;
  status.textContent = label;
  return status;
}
