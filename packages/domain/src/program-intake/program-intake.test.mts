import { describe, expect, it } from "vitest";
import { parseProgramAnswers, parseProgramQuestions } from "./index.js";

describe("participating program intake boundary", () => {
  const questions = parseProgramQuestions([
    {
      id: "need",
      label: "What support do you need?",
      type: "long_text",
      required: true,
    },
    {
      id: "contact",
      label: "Contact preference",
      type: "select",
      required: true,
      options: ["In-app", "Email"],
    },
  ])!;

  it("accepts only configured, complete answers", () => {
    expect(
      parseProgramAnswers(
        { need: "Food support", contact: "In-app" },
        questions,
      ),
    ).toEqual({ need: "Food support", contact: "In-app" });
    expect(
      parseProgramAnswers(
        { need: "Food support", contact: "Phone" },
        questions,
      ),
    ).toBeNull();
    expect(
      parseProgramAnswers(
        {
          need: "Food support",
          contact: "In-app",
          socialInsuranceNumber: "123",
        },
        questions,
      ),
    ).toBeNull();
  });

  it("rejects duplicate question ids that could change the meaning of submitted answers", () => {
    expect(
      parseProgramQuestions([
        { id: "need", label: "Need", type: "short_text", required: true },
        {
          id: "need",
          label: "Changed meaning",
          type: "short_text",
          required: false,
        },
      ]),
    ).toBeNull();
  });
});
