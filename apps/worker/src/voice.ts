import { z } from "zod";
import { submitCaseSchema } from "@civicresolve/contracts";

const webhookSchema = z.object({
  type: z.string(),
  data: z.object({
    agent_id: z.string(),
    conversation_id: z.string(),
    transcript: z
      .array(
        z.object({
          role: z.string(),
          message: z.string().nullable().optional(),
        }),
      )
      .optional(),
    analysis: z
      .object({
        data_collection_results: z.record(
          z.string(),
          z.object({ value: z.unknown() }).optional(),
        ),
      })
      .optional(),
  }),
});

export async function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key && value) parts[key] = value;
  }
  const timestamp = Number(parts.t);
  const hex = parts.v0;
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > 30 * 60 ||
    !hex ||
    !/^[0-9a-f]{64}$/i.test(hex)
  )
    return false;
  const signature = Uint8Array.from(hex.match(/../g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
}

export function parseVoiceReport(rawBody: string) {
  const event = webhookSchema.parse(JSON.parse(rawBody));
  if (event.type !== "post_call_transcription")
    return { type: "ignored" as const };
  const fields = event.data.analysis?.data_collection_results;
  const description = fields?.issue_description?.value;
  const location = fields?.location?.value;
  const confirmed = fields?.confirmed?.value;
  const intake = submitCaseSchema.safeParse({ description, location });
  if (!intake.success || confirmed !== true)
    return {
      type: "incomplete" as const,
      conversationId: event.data.conversation_id,
    };
  return {
    type: "ready" as const,
    conversationId: event.data.conversation_id,
    agentId: event.data.agent_id,
    transcript: event.data.transcript ?? [],
    intake: intake.data,
  };
}
