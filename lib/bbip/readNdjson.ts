// lib/bbip/readNdjson.ts
import type { StreamEvent } from "./types";

export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as StreamEvent;
      newline = buffer.indexOf("\n");
    }
  }
  const rest = (buffer + decoder.decode()).trim();
  if (rest) yield JSON.parse(rest) as StreamEvent;
}
