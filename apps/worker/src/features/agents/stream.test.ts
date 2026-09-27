import { describe, expect, it } from "vitest";
import { modelDeltas } from "./stream.js";

function chunks(...parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

describe("Workers AI event deltas", () => {
  it("reads actual streamed tokens across transport boundaries", async () => {
    const output: string[] = [];
    for await (const delta of modelDeltas(
      chunks(
        'data: {"choices":[{"delta":{"content":"Hel',
        'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        "data: [DONE]\n\n",
      ),
    ))
      output.push(delta);
    expect(output).toEqual(["Hello", " world"]);
  });

  it("handles a cumulative response variant without repeating text", async () => {
    const output: string[] = [];
    for await (const delta of modelDeltas(
      chunks(
        'data: {"response":"Hi"}\n\ndata: {"response":"Hi there"}\n\ndata: [DONE]\n\n',
      ),
    ))
      output.push(delta);
    expect(output).toEqual(["Hi", " there"]);
  });
});
