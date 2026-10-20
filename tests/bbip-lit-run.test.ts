// tests/bbip-lit-run.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PaperHit, StreamEvent, WebHit } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let service: typeof import("../lib/services/bbipService");
let lit: typeof import("../lib/bbip/literature/runLiterature");
let route: typeof import("../app/api/bbip/sessions/[id]/literature/route");
let promote: typeof import("../lib/bbip/promote");

beforeAll(async () => {
  env = await setupTempDb("bbip-lit-run");
  service = await import("../lib/services/bbipService");
  lit = await import("../lib/bbip/literature/runLiterature");
  route = await import("../app/api/bbip/sessions/[id]/literature/route");
  promote = await import("../lib/bbip/promote");
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

  it("never reads or writes the cache when told not to (fake mode)", async () => {
    const cacheMod = await import("../lib/bbip/literature/cache");
    const d = deps({ useCache: false, query: vi.fn(async () => ({ query: { pubmed: "nocache-q", web: "nocache-w" } })) });
    await collect(lit.runLiterature(newSession().id, d));
    await collect(lit.runLiterature(newSession().id, d));
    expect(d.pubmed).toHaveBeenCalledTimes(2);
    expect(cacheMod.readCache("pubmed", "nocache-q")).toBeNull();
    expect(cacheMod.readCache("web", "nocache-w")).toBeNull();
  });

  it("refetches web results when the allowed domains change", async () => {
    const query = vi.fn(async () => ({ query: { pubmed: "", web: "domains-w" } }));
    const web = vi.fn(async () => [hit]);
    await collect(lit.runLiterature(newSession().id, deps({ query, web, webVariant: "a" })));
    await collect(lit.runLiterature(newSession().id, deps({ query, web, webVariant: "a" })));
    await collect(lit.runLiterature(newSession().id, deps({ query, web, webVariant: "b" })));
    expect(web).toHaveBeenCalledTimes(2);
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

  it("keeps earlier [P#]/[W#] pointing at the same sources on a re-search", async () => {
    const session = newSession();
    const paper2: PaperHit = { ...paper, pmid: "38000002", title: "Pico RCT", level: "rct" };
    const hit2: WebHit = { url: "https://www.fda.gov/y", title: "FDA 2", snippet: "" };
    await collect(lit.runLiterature(session.id, deps()));
    const before = service.getSession(session.id)!.literature!;
    const oldTurn = "효과 있음 [P1]. 허가 [W1].";
    const sourcesBefore = promote.literatureSources(oldTurn, before).sources.map((s) => s.url);

    // The new search ranks a new paper first and repeats the old ones.
    const events = await collect(
      lit.runLiterature(session.id, deps({ pubmed: vi.fn(async () => [paper2, paper]), web: vi.fn(async () => [hit2, { ...hit, url: "https://WWW.fda.gov/x/" }]) }))
    );
    const after = service.getSession(session.id)!.literature!;
    expect(after.papers.map((p) => p.pmid)).toEqual(["38000001", "38000002"]);
    expect(after.web.map((w) => w.url)).toEqual(["https://www.fda.gov/x", "https://www.fda.gov/y"]);
    expect(events[0]).toMatchObject({ type: "literature", block: { papers: after.papers, web: after.web } });
    expect(promote.literatureSources(oldTurn, after).sources.map((s) => s.url)).toEqual(sourcesBefore);
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

describe("mergeLiterature", () => {
  const block = (papers: string[], web: string[], q = "q1") => ({
    pubmedQuery: q,
    webQuery: q,
    papers: papers.map((pmid) => ({ ...paper, pmid })),
    web: web.map((url) => ({ ...hit, url })),
    errors: {},
    fetchedAt: q,
  });

  it("takes the first block as is, then only appends new sources", () => {
    const first = block(["1", "2"], ["https://a.org/x"]);
    expect(lit.mergeLiterature(undefined, first)).toEqual(first);
    const merged = lit.mergeLiterature(first, { ...block(["3", "1"], ["https://a.org/x#top", "https://b.org"], "q2"), errors: { web: "x" } });
    expect(merged.papers.map((p) => p.pmid)).toEqual(["1", "2", "3"]);
    expect(merged.web.map((w) => w.url)).toEqual(["https://a.org/x", "https://b.org"]);
    expect(merged).toMatchObject({ pubmedQuery: "q2", fetchedAt: "q2", errors: { web: "x" } });
  });

  it("caps the totals by dropping new sources, never existing ones", () => {
    const full = block(Array.from({ length: lit.MAX_PAPERS }, (_, i) => `p${i}`), []);
    const merged = lit.mergeLiterature(full, block(["new"], []));
    expect(merged.papers).toHaveLength(lit.MAX_PAPERS);
    expect(merged.papers[0]!.pmid).toBe("p0");
    expect(merged.papers.some((p) => p.pmid === "new")).toBe(false);
  });
});
