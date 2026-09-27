/** Extract text deltas from the SSE body returned by Workers AI. */
export async function* modelDeltas(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let cumulative = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data === "[DONE]") return;
        if (data) {
          let parsed: {
            response?: unknown;
            choices?: Array<{ delta?: { content?: unknown } }>;
          };
          try {
            parsed = JSON.parse(data) as typeof parsed;
          } catch {
            parsed = {};
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) yield delta;
          else if (typeof parsed.response === "string") {
            const next = parsed.response.startsWith(cumulative)
              ? parsed.response.slice(cumulative.length)
              : parsed.response;
            cumulative = parsed.response;
            if (next) yield next;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
