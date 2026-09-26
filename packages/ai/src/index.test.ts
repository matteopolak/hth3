import { describe, expect, it, vi } from "vitest";
import { taxonomy } from "@civicresolve/fixtures";
import {
  classifyWithFallback,
  JevClassificationProvider,
  WorkersAIClassificationProvider,
} from "./index";

const input = {
  text: "Lifted sidewalk by the library",
  taxonomy,
  extractedFields: { location: "library" },
};

describe("classification adapters", () => {
  it("accepts a bounded Jev choice", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              answers: {
                category: { choice: "sidewalk", confidence: 0.91 },
              },
            },
          }),
          { status: 200 },
        ),
    );
    const result = await new JevClassificationProvider(
      "test",
      fetcher,
    ).classify(input);
    expect(result.categoryId).toBe("sidewalk");
    expect(result.provider).toBe("jev");
  });
  it("rejects a category outside the active taxonomy", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              answers: {
                category: { choice: "unauthorized", confidence: 0.99 },
              },
            },
          }),
          { status: 200 },
        ),
    );
    await expect(
      new JevClassificationProvider("test", fetcher).classify(input),
    ).rejects.toThrow();
  });
  it("falls back to Workers AI after a Jev failure", async () => {
    const primary = {
      classify: vi.fn(async () => {
        throw new Error("timeout");
      }),
    };
    const fallback = new WorkersAIClassificationProvider({
      run: async () => ({
        response: {
          categoryId: "sidewalk",
          confidence: 0.8,
          rationale: "Sidewalk damage",
        },
      }),
    });
    expect(
      (await classifyWithFallback(input, primary, fallback)).provider,
    ).toBe("workers-ai");
  });
});
