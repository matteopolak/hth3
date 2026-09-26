import { describe, expect, it } from "vitest";
import {
  formatPreparationDocument,
  validateExternalPreparation,
} from "./index.js";

describe("external application preparation", () => {
  it("keeps an applicant's notes separate from an external submission", () => {
    const preparation = validateExternalPreparation({
      status: "submitted",
      answers: [
        {
          id: "experience",
          question: "Relevant experience",
          response: "Three years",
        },
      ],
      checklist: [
        {
          id: "verify",
          text: "Check requirements on the publisher's site",
          done: false,
        },
      ],
    });
    expect(preparation?.status).toBe("prepared-for-external");
    const document = formatPreparationDocument({
      title: "Official opportunity",
      publisher: "Publisher",
      officialUrl: "https://example.org/apply",
      preparation: preparation!,
      locale: "en",
    });
    expect(document).toContain("Three years");
    expect(document).toContain(
      "Envoy has not recorded an external submission.",
    );

    const participationDocument = formatPreparationDocument({
      title: "Public consultation",
      publisher: "Publisher",
      officialUrl: "https://example.org/consultation",
      preparation: preparation!,
      locale: "fr",
      purpose: "participation",
    });
    expect(participationDocument).toContain("participation externe");
    expect(participationDocument).toContain("aucune contribution externe");
    expect(participationDocument).not.toContain("demande externe");
  });

  it("rejects malformed or oversized answer collections", () => {
    expect(
      validateExternalPreparation({
        answers: [{ id: "one", question: "", response: "" }],
        checklist: [],
      }),
    ).toBeNull();
    expect(
      validateExternalPreparation({
        answers: [],
        checklist: [{ id: "one", text: "Check", done: "yes" }],
      }),
    ).toBeNull();
    expect(
      validateExternalPreparation({
        answers: Array(25).fill({
          id: "same",
          question: "Question",
          response: "Answer",
        }),
        checklist: [],
      }),
    ).toBeNull();
  });
});
