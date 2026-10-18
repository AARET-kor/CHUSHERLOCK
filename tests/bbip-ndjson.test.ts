// tests/bbip-ndjson.test.ts
import { describe, expect, it } from "vitest";
import { ndjsonStream } from "../lib/bbip/ndjson";
import { readNdjson } from "../lib/bbip/readNdjson";
import { sectionKeySchema } from "../lib/bbip/schemas";
import { SECTIONS } from "../lib/bbip/sections";
import type { StreamEvent } from "../lib/bbip/types";

async function* events(): AsyncGenerator<StreamEvent> {
  yield { type: "start", turnId: "t" };
  yield { type: "delta", text: "줄\n바꿈 포함" };
  yield { type: "done", turnId: "t" };
}

describe("NDJSON round trip", () => {
  it("survives arbitrary chunk boundaries", async () => {
    const bytes = new Uint8Array(await new Response(ndjsonStream(events())).arrayBuffer());
    const rechunked = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    });
    const out: StreamEvent[] = [];
    for await (const event of readNdjson(rechunked)) out.push(event);
    expect(out).toEqual([
      { type: "start", turnId: "t" },
      { type: "delta", text: "줄\n바꿈 포함" },
      { type: "done", turnId: "t" },
    ]);
  });

  it("keeps draining after the consumer cancels", async () => {
    let drained = false;
    async function* slow(): AsyncGenerator<StreamEvent> {
      yield { type: "start", turnId: "t" };
      await new Promise((r) => setTimeout(r, 20));
      yield { type: "delta", text: "late" };
      drained = true;
    }
    const reader = ndjsonStream(slow()).getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((r) => setTimeout(r, 60));
    expect(drained).toBe(true);
  });
});

describe("sectionKeySchema", () => {
  it("matches the section table", () => {
    expect([...sectionKeySchema.options].sort()).toEqual(SECTIONS.map((s) => s.key).sort());
  });
});
