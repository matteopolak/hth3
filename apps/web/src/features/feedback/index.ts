import type { Locale } from "@civicresolve/contracts/v1";

const copy = {
  en: {
    summary: "Need help getting started?",
    hint: "Choose a short starting point, then write it in your own words.",
    options: [
      { label: "Report a problem", start: "I noticed an issue with " },
      { label: "Suggest a change", start: "I have an idea for " },
      { label: "Ask a question", start: "I would like to ask about " },
    ],
  },
  fr: {
    summary: "Besoin d’aide pour commencer?",
    hint: "Choisissez un début de phrase, puis décrivez la situation à votre façon.",
    options: [
      {
        label: "Signaler un problème",
        start: "J’ai remarqué un problème avec ",
      },
      { label: "Proposer un changement", start: "J’ai une idée pour " },
      {
        label: "Poser une question",
        start: "J’aimerais poser une question au sujet de ",
      },
    ],
  },
} satisfies Record<
  Locale,
  {
    summary: string;
    hint: string;
    options: Array<{ label: string; start: string }>;
  }
>;

/** Adds optional writing starters without changing the resident feedback payload. */
export function addFeedbackWritingStarters(
  form: HTMLElement,
  locale: Locale,
): void {
  const message = form.querySelector<HTMLTextAreaElement>("#feedback-message");
  const suggestion = form.querySelector<HTMLElement>(".feedback-extra");
  if (!message || !suggestion) return;

  const text = copy[locale];
  const guide = document.createElement("details");
  guide.className = "feedback-writing-guide";
  const summary = document.createElement("summary");
  summary.textContent = text.summary;
  const body = document.createElement("div");
  body.className = "feedback-writing-guide-body";
  const hint = document.createElement("p");
  hint.textContent = text.hint;
  const choices = document.createElement("div");
  choices.className = "feedback-writing-choices";

  for (const option of text.options) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.textContent = option.label;
    choice.addEventListener("click", () => {
      const existing = message.value.trimEnd();
      message.value = `${existing}${existing ? "\n\n" : ""}${option.start}`;
      message.dispatchEvent(new Event("input", { bubbles: true }));
      guide.open = false;
      message.focus();
      message.setSelectionRange(message.value.length, message.value.length);
    });
    choices.append(choice);
  }
  body.append(hint, choices);
  guide.append(summary, body);
  suggestion.before(guide);
}
