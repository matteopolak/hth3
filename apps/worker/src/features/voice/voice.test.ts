import { describe, expect, it } from "vitest";
import { confirmedFeedbackMessage } from "./index.js";

const issue = {
  role: "user" as const,
  message: "A streetlight near my home has been dark for two nights.",
};
const englishDisclosure = {
  role: "agent" as const,
  message:
    "A streetlight near your home has been dark for two nights. This will go only to Envoy's review team, not a government office. Is this summary accurate, and should I submit it now? Say yes, submit it to confirm.",
};

describe("spoken voice submission", () => {
  it("accepts a resident confirmation after the review-team disclosure", () => {
    expect(
      confirmedFeedbackMessage([
        issue,
        englishDisclosure,
        { role: "user", message: "Yes, submit it." },
      ]),
    ).toBe(issue.message);
  });

  it("does not accept confirmation without the government disclaimer", () => {
    expect(
      confirmedFeedbackMessage([
        issue,
        { role: "agent", message: "Envoy's review team can submit this now." },
        { role: "user", message: "Yes, submit it." },
      ]),
    ).toBeNull();
  });

  it("does not submit when the agent skips the summary", () => {
    expect(
      confirmedFeedbackMessage([
        issue,
        {
          role: "agent",
          message:
            "This will go only to Envoy's review team, not a government office. Is this summary accurate, and should I submit it now? Say yes, submit it to confirm.",
        },
        { role: "user", message: "Yes, submit it." },
      ]),
    ).toBeNull();
  });

  it("accepts a separate summary immediately before the disclosure", () => {
    expect(
      confirmedFeedbackMessage([
        issue,
        {
          role: "agent",
          message: "A streetlight near your home has been dark for two nights.",
        },
        {
          role: "agent",
          message:
            "This will go only to Envoy's review team, not a government office. Is this summary accurate, and should I submit it now? Say yes, submit it to confirm.",
        },
        { role: "user", message: "Yes, submit it." },
      ]),
    ).toBe(issue.message);
  });

  it("does not infer submission from the agent's words", () => {
    expect(
      confirmedFeedbackMessage([
        issue,
        englishDisclosure,
        { role: "agent", message: "Yes, submit it." },
      ]),
    ).toBeNull();
  });

  it("accepts the equivalent French disclosure and confirmation", () => {
    expect(
      confirmedFeedbackMessage([
        issue,
        {
          role: "agent",
          message:
            "Un lampadaire près de chez vous est éteint depuis deux nuits. Cela sera envoyé uniquement à l'équipe de révision d'Envoy, pas à un bureau gouvernemental. Ce résumé est-il exact et dois-je l'envoyer maintenant? Dites oui, envoyez-le pour confirmer.",
        },
        { role: "user", message: "Oui, envoyez-le." },
      ]),
    ).toBe(issue.message);
  });
});
