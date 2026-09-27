import { describe, expect, it } from "vitest";
import { en, fr, translate } from "../src/index.js";

describe("English and French catalogues", () => {
  it("have the same message keys and interpolation placeholders", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());

    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      const englishPlaceholders = [
        ...en[key].matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g),
      ]
        .map((match) => match[1])
        .sort();
      const frenchPlaceholders = [
        ...fr[key].matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g),
      ]
        .map((match) => match[1])
        .sort();
      expect(frenchPlaceholders, `placeholder mismatch for ${key}`).toEqual(
        englishPlaceholders,
      );
    }
  });

  it("preserves French privacy guidance and substitutes message values", () => {
    const privacyNotice = fr["feedback.privacyNotice"];
    expect(privacyNotice).toContain("mot de passe");
    expect(privacyNotice).toContain("renseignement bancaire");
    expect(privacyNotice).toContain("numéro d’assurance sociale");
    expect(privacyNotice).toContain("équipe d’Envoy");
    expect(privacyNotice).toMatch(
      /(?:pas à un organisme gouvernemental|aucun organisme gouvernemental ne reçoit)/,
    );
    expect(
      translate("fr", "assistant.resumeSaved", { filename: "cv-test.pdf" }),
    ).toContain("cv-test.pdf");
  });
});
