import { describe, expect, it } from "vitest";
import { parseVoiceReport, verifyElevenLabsSignature } from "./voice";

const event = JSON.stringify({
  type: "post_call_transcription",
  data: {
    agent_id: "agent-demo",
    conversation_id: "conv-123",
    transcript: [
      { role: "user", message: "The sidewalk near the library is dangerous" },
    ],
    analysis: {
      data_collection_results: {
        issue_description: {
          value: "The sidewalk pavement near the library is lifted",
        },
        location: { value: "Central Library" },
        confirmed: { value: true },
      },
    },
  },
});

describe("voice webhook", () => {
  it("verifies HMAC over timestamp and raw body and rejects stale signatures", async () => {
    const timestamp = 1_800_000_000;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${event}`),
      ),
    );
    const hex = [...signature]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(
      await verifyElevenLabsSignature(
        event,
        `t=${timestamp},v0=${hex}`,
        "secret",
        timestamp,
      ),
    ).toBe(true);
    expect(
      await verifyElevenLabsSignature(
        event + " ",
        `t=${timestamp},v0=${hex}`,
        "secret",
        timestamp,
      ),
    ).toBe(false);
    expect(
      await verifyElevenLabsSignature(
        event,
        `t=${timestamp},v0=${hex}`,
        "secret",
        timestamp + 1801,
      ),
    ).toBe(false);
  });
  it("requires confirmed structured intake", () => {
    expect(parseVoiceReport(event).type).toBe("ready");
    expect(
      parseVoiceReport(event.replace('"value":true', '"value":false')).type,
    ).toBe("incomplete");
  });
});
