// lib/bbip/ndjson.ts
import type { StreamEvent } from "./types";

/** Push-style stream: the generator is drained in start(), so a turn keeps
 * generating and saving even after the client disconnects. */
export function ndjsonStream(events: AsyncIterable<StreamEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      for await (const event of events) {
        if (!open) continue;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      }
      if (open) {
        try {
          controller.close();
        } catch {
          /* consumer already cancelled */
        }
      }
    },
  });
}
