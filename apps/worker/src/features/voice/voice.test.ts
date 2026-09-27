import { describe, expect, it } from "vitest";
import { confirmedFeedbackMessage } from "./index.js";

const issue = {
  role: "user" as const,
  message: "A streetlight near my home has been dark for two nights.",
};
const englishDisclosure = {
  role: "agent" as const,
  message:
    "This will go only to Envoy's review team, not a government office. Is this summary accurate, and should I submit it now? Say yes, submit it to confirm.",
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
            "Cela sera envoyé uniquement à l'équipe de révision d'Envoy, pas à un bureau gouvernemental. Ce résumé est-il exact et dois-je l'envoyer maintenant? Dites oui, envoyez-le pour confirmer.",
        },
        { role: "user", message: "Oui, envoyez-le." },
      ]),
    ).toBe(issue.message);
  });
});
