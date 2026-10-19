// tests/bbip-promote.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let promoteRoute: typeof import("../app/api/bbip/turns/[turnId]/promote/route");
let service: typeof import("../lib/services/bbipService");
let entryService: typeof import("../lib/services/entryService");
let promote: typeof import("../lib/bbip/promote");
let context: typeof import("../lib/bbip/context");
let sourceEntryId = "";

beforeAll(async () => {
  env = await setupTempDb("bbip-promote");
  entryService = await import("../lib/services/entryService");
  const schemas = await import("../lib/schemas/entrySchemas");
  const created = await entryService.createEntry(
    schemas.createEntrySchema.parse({
      title: "피코토닝 기미 프로토콜",
      content: "기미 피코토닝은 저출력으로 반복 조사한다.",
      categoryKey: "pico-toning",
      tier: "procedure_tip",
      tags: ["피코토닝"],
      sources: [{ type: "book", citation: "승격 테스트 교과서" }],
      status: "reviewed",
    })
  );
  sourceEntryId = created.entry.id;
  service = await import("../lib/services/bbipService");
  promote = await import("../lib/bbip/promote");
  context = await import("../lib/bbip/context");
  promoteRoute = await import("../app/api/bbip/turns/[turnId]/promote/route");
});
afterAll(() => env.cleanup());

function makeDoneTurn(output: string) {
  const session = service.createSession({
    chips: { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
    flags: [],
    sourceNoteIds: [sourceEntryId],
  });
  const turn = service.startTurn(session.id, { kind: "section", sectionKey: "ddx" }, "fake");
  service.finishTurn(turn.id, output, []);
  return { session, turn: service.getTurn(turn.id)! };
}

function req(method: string, body?: unknown): Request {
  return new Request("http://test.local/api", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("promote helpers", () => {
  it("maps cited papers and web pages to sources with levels on their claims", () => {
    const { session, turn } = makeDoneTurn(
      "- 피코토닝은 MASI를 낮춘다 (메타분석) [P2]\n- 허가 범위 내 사용 [W1]\n- 일반적으로 반복 시술한다 [AI]\n- 미인용 논문은 빠진다"
    );
    const literature = {
      pubmedQuery: "q",
      webQuery: "w",
      errors: {},
      fetchedAt: "2026-10-19T00:00:00.000Z",
      papers: [
        { pmid: "1", title: "Uncited", authors: [], journal: "J", abstract: "", publicationTypes: [], level: "case" as const },
        {
          pmid: "38000001",
          title: "Pico meta",
          authors: ["Kim J", "Lee S", "Park H", "Choi Y"],
          year: 2024,
          journal: "JAAD",
          abstract: "",
          publicationTypes: ["Meta-Analysis"],
          level: "meta" as const,
        },
      ],
      web: [{ url: "https://www.fda.gov/label", title: "FDA label", snippet: "" }],
    };
    const input = promote.buildPromoteInput({
      session: { ...session, literature },
      turn,
      notes: [],
      title: "피코토닝 문헌",
      categoryKey: "pico-toning",
      tier: "deep_study",
      today: "2026-10-19",
    });
    expect(input.sources).toEqual([
      { type: "other", citation: "BBIP AI 보충 · fake · 2026-10-19" },
      {
        type: "paper",
        citation: "Kim J, Lee S, Park H et al. (2024). Pico meta. JAAD. PMID 38000001",
        url: "https://pubmed.ncbi.nlm.nih.gov/38000001/",
        authors: "Kim J, Lee S, Park H et al.",
        year: 2024,
        evidenceLevel: "systematic_review",
      },
      { type: "website", citation: "FDA label — https://www.fda.gov/label", url: "https://www.fda.gov/label" },
    ]);
    expect(input.content).toContain("(PMID 38000001)");
    expect(input.content).toContain("(fda.gov)");
    expect(input.claims.map((c) => [c.sourceIndex, c.evidenceLevel])).toEqual([
      [1, "systematic_review"],
      [2, "unknown"],
      [0, "unknown"],
      [0, "unknown"],
    ]);
    expect(input.claims[0]!.claimText).toBe("피코토닝은 MASI를 낮춘다 (메타분석) (PMID 38000001)");
  });

  it("builds draft input with relations, AI source and claims", () => {
    const { session, turn } = makeDoneTurn(
      "| 감별 | 포인트 |\n|---|---|\n| ABNOM | 양측성 회갈색 점 [1] |\n- 우드램프 소견 차이 확인 [AI]"
    );
    const input = promote.buildPromoteInput({
      session,
      turn,
      notes: [{ n: 1, id: sourceEntryId, title: "t", categoryLabel: "c", verified: true }],
      title: "기미 감별",
      categoryKey: "melasma",
      tier: "deep_study",
      today: "2026-10-18",
    });
    expect(input.status).toBe("draft");
    expect(input.relatedEntryIds).toEqual([sourceEntryId]);
    expect(input.sources[0]!.citation).toBe("BBIP AI 보충 · fake · 2026-10-18");
    expect(input.content).toContain("(AI 보충)");
    expect(input.content).not.toContain("[1]");
    expect(input.claims.every((c) => c.representation === "ai_paraphrase")).toBe(true);
    expect(input.claims.some((c) => /^[\s|:-]+$/.test(c.claimText))).toBe(false);
    expect(input.tags).toEqual(["bbip", "피코토닝"]);
  });

  it("does not relate or cite unverified BBIP drafts as notes", () => {
    const { session, turn } = makeDoneTurn("- 확인된 노트 내용입니다 [1]\n- 초안에서 온 내용입니다 [2]");
    const input = promote.buildPromoteInput({
      session,
      turn,
      notes: [
        { n: 1, id: sourceEntryId, title: "t", categoryLabel: "c", verified: true },
        { n: 2, id: "draft-id", title: "초안", categoryLabel: "c", verified: false },
      ],
      title: "기미 감별",
      categoryKey: "melasma",
      tier: "deep_study",
      today: "2026-10-18",
    });
    expect(input.relatedEntryIds).toEqual([sourceEntryId]);
    expect(input.content).toBe("- 확인된 노트 내용입니다\n- 초안에서 온 내용입니다 (AI 보충)");
  });

  it("suggests defaults from the session", async () => {
    const { session, turn } = makeDoneTurn("내용 [AI]");
    const entries = await entryService.listEntries();
    const defaults = promote.promoteDefaults(session, turn, context.selectPromptNotes(session, entries));
    expect(defaults).toEqual({ title: "피코토닝·기미 — 감별질환", categoryKey: "pico-toning", tier: "deep_study" });
  });
});

describe("promote route", () => {
  it("saves once, then refuses a second save", async () => {
    const { turn } = makeDoneTurn("- 저출력 반복이 기본 [1]\n- 재발 설명 필요 [AI]");
    const params = Promise.resolve({ turnId: turn.id });

    const defaults = await (await promoteRoute.GET(req("GET"), { params })).json();
    expect(defaults.tier).toBe("deep_study");

    const saved = await promoteRoute.POST(req("POST", { ...defaults }), { params });
    expect(saved.status).toBe(200);
    const { entryId } = await saved.json();
    const entry = await entryService.getEntry(entryId);
    expect(entry).toMatchObject({ status: "draft" });
    expect(service.getTurn(turn.id)?.promotedEntryId).toBe(entryId);

    const again = await promoteRoute.POST(req("POST", { ...defaults }), { params });
    expect(again.status).toBe(409);
  });

  it("treats the promoted draft as unverified in later sessions", async () => {
    const { turn } = makeDoneTurn("- 새 내용입니다 [AI]");
    const params = Promise.resolve({ turnId: turn.id });
    const defaults = await (await promoteRoute.GET(req("GET"), { params })).json();
    const { entryId } = await (await promoteRoute.POST(req("POST", defaults), { params })).json();
    const later = service.createSession({
      chips: { patient: [], conditions: [], meds: [], procedures: ["피코토닝"] },
      flags: [],
      sourceNoteIds: [entryId],
    });
    const notes = context.selectPromptNotes(later, await entryService.listEntries());
    expect(notes[0]?.verified).toBe(false);
  });

  it("rejects unknown or unfinished turns", async () => {
    const missing = await promoteRoute.GET(req("GET"), { params: Promise.resolve({ turnId: "x" }) });
    expect(missing.status).toBe(404);
    const session = service.createSession({
      chips: { patient: [], conditions: ["기미"], meds: [], procedures: [] },
      flags: [],
      sourceNoteIds: [],
    });
    const streaming = service.startTurn(session.id, { kind: "brief" }, "fake");
    const res = await promoteRoute.POST(
      req("POST", { title: "제목입니다", categoryKey: "melasma", tier: "deep_study" }),
      { params: Promise.resolve({ turnId: streaming.id }) }
    );
    expect(res.status).toBe(409);
  });
});

describe("promote route validation and races", () => {
  const body = { title: "제목입니다", tier: "deep_study" as const };

  it("rejects unknown and non-leaf categories with a readable message", async () => {
    const { turn } = makeDoneTurn("- 저출력 반복이 기본입니다 [AI]");
    const params = Promise.resolve({ turnId: turn.id });
    for (const categoryKey of ["no-such-category", "botox"]) {
      const res = await promoteRoute.POST(req("POST", { ...body, categoryKey }), { params });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("카테고리를 선택해 주세요.");
    }
  });

  it("surfaces entry validation failures as plain text, not Zod JSON", async () => {
    const { turn } = makeDoneTurn("확인 필요 [1]");
    const res = await promoteRoute.POST(req("POST", { ...body, categoryKey: "melasma" }), {
      params: Promise.resolve({ turnId: turn.id }),
    });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(typeof error).toBe("string");
    expect(error.trimStart().startsWith("[")).toBe(false);
    expect(error).not.toContain('"code"');
  });

  it("rejects a selection that is not part of the card", async () => {
    const { turn } = makeDoneTurn("- 저출력 반복이 기본입니다 [AI]");
    const res = await promoteRoute.POST(
      req("POST", { ...body, categoryKey: "melasma", selection: "카드에 없는 문장입니다 정말로" }),
      { params: Promise.resolve({ turnId: turn.id }) }
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("선택한 내용이 카드에 없습니다.");
  });

  it("lets exactly one of two concurrent saves win", async () => {
    const { turn } = makeDoneTurn("- 동시 저장 테스트 내용입니다 [AI]\n- 두 번째 줄도 충분히 깁니다 [AI]");
    const before = (await entryService.listEntries()).length;
    const send = () =>
      promoteRoute.POST(req("POST", { ...body, categoryKey: "melasma" }), {
        params: Promise.resolve({ turnId: turn.id }),
      });
    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const ok = await (a.status === 200 ? a : b).json();
    const dup = await (a.status === 409 ? a : b).json();
    expect(dup.entryId).toBe(ok.entryId);
    expect((await entryService.listEntries()).length).toBe(before + 1);
  });
});
