import type { StreamEvent } from "./types";

/** Push-style stream: the generator is drained in start(), so a turn keeps
 * generating and saving even after the client disconnects. There is
 * intentionally no backpressure: output is bounded by one card, and the
 * generator must run to completion so the turn gets persisted. */
export function ndjsonStream(events: AsyncIterable<StreamEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        for await (const event of events) send(event);
      } catch {
        send({ type: "error", message: "생성 실패" });
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
