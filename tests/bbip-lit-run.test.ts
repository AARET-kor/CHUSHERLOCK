// tests/bbip-lit-run.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PaperHit, StreamEvent, WebHit } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let service: typeof import("../lib/services/bbipService");
let lit: typeof import("../lib/bbip/literature/runLiterature");
let route: typeof import("../app/api/bbip/sessions/[id]/literature/route");

beforeAll(async () => {
  env = await setupTempDb("bbip-lit-run");
  service = await import("../lib/services/bbipService");
  lit = await import("../lib/bbip/literature/runLiterature");
  route = await import("../app/api/bbip/sessions/[id]/literature/route");
});
afterAll(() => env.cleanup());

const paper: PaperHit = {
  pmid: "38000001",
  title: "Pico meta",
  authors: ["Kim J"],
  year: 2024,
  journal: "JAAD",
  abstract: "",
  publicationTypes: ["Meta-Analysis"],
  level: "meta",
};
const hit: WebHit = { url: "https://www.fda.gov/x", title: "FDA", snippet: "" };

function newSession() {
  return service.createSession({
    chips: { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
    flags: [],
    sourceNoteIds: [],
  });
}

async function collect(events: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

function deps(over: Partial<import("../lib/bbip/literature/runLiterature").LiteratureDeps> = {}) {
  return {
    query: vi.fn(async () => ({ query: { pubmed: `"Melasma" ${crypto.randomUUID()}`, web: `melasma ${crypto.randomUUID()}` } })),
    pubmed: vi.fn(async () => [paper]),
    web: vi.fn(async () => [hit]),
    runTurn: vi.fn(async function* (): AsyncGenerator<StreamEvent> {
      yield { type: "done", turnId: "t" };
    }),
    now: () => new Date("2026-10-19T00:00:00.000Z"),
    ...over,
  };
}

describe("runLiterature", () => {
  it("searches, stores the block on the session and delegates the card", async () => {
    const session = newSession();
    const d = deps();
    const events = await collect(lit.runLiterature(session.id, d));
    expect(events[0]).toMatchObject({ type: "literature", block: { papers: [paper], web: [hit], errors: {} } });
    expect(events.at(-1)).toEqual({ type: "done", turnId: "t" });
    expect(d.runTurn).toHaveBeenCalledWith(session.id, { kind: "literature" });
    expect(service.getSession(session.id)?.literature?.papers).toEqual([paper]);
  });

  it("serves a repeated query from the cache", async () => {
    const d = deps({ query: vi.fn(async () => ({ query: { pubmed: "same-q", web: "same-w" } })) });
    await collect(lit.runLiterature(newSession().id, d));
    await collect(lit.runLiterature(newSession().id, d));
    expect(d.pubmed).toHaveBeenCalledTimes(1);
    expect(d.web).toHaveBeenCalledTimes(1);
  });

  it("continues with one provider when the other fails", async () => {
    const d = deps({ web: vi.fn(async () => { throw new Error("down"); }) });
    const events = await collect(lit.runLiterature(newSession().id, d));
    expect(events[0]).toMatchObject({ type: "literature", block: { papers: [paper], web: [], errors: { web: "웹 검색에 실패했습니다." } } });
    expect(d.runTurn).toHaveBeenCalled();
  });

  it("stores a failed card with the queries when nothing is found", async () => {
    const session = newSession();
    const d = deps({ pubmed: vi.fn(async () => []), web: vi.fn(async () => []) });
    const events = await collect(lit.runLiterature(session.id, d));
    expect(d.runTurn).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toEqual(["literature", "start", "delta", "error"]);
    const [turn] = service.listTurns(session.id);
    expect(turn).toMatchObject({ kind: "literature", status: "failed", error: "문헌을 찾지 못했습니다." });
    expect(turn!.output).toContain("문헌을 찾지 못했습니다");
    expect(turn!.output).toContain('"Melasma"');
  });

  it("reports an unknown session", async () => {
    expect(await collect(lit.runLiterature("missing", deps()))).toEqual([
      { type: "error", message: "세션을 찾을 수 없습니다." },
    ]);
  });
});

describe("POST /api/bbip/sessions/[id]/literature", () => {
  it("404s for an unknown session and streams NDJSON (fake mode) otherwise", async () => {
    const missing = await route.POST(new Request("http://t/x", { method: "POST" }), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(missing.status).toBe(404);
    const session = newSession();
    const res = await route.POST(new Request("http://t/x", { method: "POST" }), {
      params: Promise.resolve({ id: session.id }),
    });
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as StreamEvent);
    expect(lines[0]!.type).toBe("literature");
    expect(lines.at(-1)!.type).toBe("done");
    const [turn] = service.listTurns(session.id);
    expect(turn).toMatchObject({ kind: "literature", status: "done", model: "fake" });
    expect(turn!.output).toContain("[P1]");
  });
});
