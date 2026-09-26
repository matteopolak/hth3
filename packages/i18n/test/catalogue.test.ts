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

  it("preserves long French privacy guidance and substitutes receipt IDs", () => {
    expect(fr["feedback.privacyNotice"].length).toBeGreaterThan(400);
    expect(fr["feedback.privacyNotice"]).toContain("renseignements");
    expect(
      translate("fr", "feedback.submitted", { receiptId: "R-123" }),
    ).toContain("R-123");
  });
});
