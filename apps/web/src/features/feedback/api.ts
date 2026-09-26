import type {
  FeedbackClientReceipt,
  ReceiptCredentials,
} from "../../platform/api.js";

const base = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

export async function reopenResidentFeedback(
  credentials: ReceiptCredentials,
  message: string,
): Promise<FeedbackClientReceipt> {
  const response = await fetch(
    `${base}/feedback/receipts/${encodeURIComponent(credentials.submissionId)}/reopen`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
        "X-Receipt-Token": credentials.receiptToken,
      },
      body: JSON.stringify({ message: message.trim() }),
    },
  );
  const payload = (await response.json()) as {
    submission?: FeedbackClientReceipt;
    error?: { message?: string };
  };
  if (!response.ok || !payload.submission)
    throw new Error(
      payload.error?.message ?? `Request failed (${response.status})`,
    );
  return payload.submission;
}
