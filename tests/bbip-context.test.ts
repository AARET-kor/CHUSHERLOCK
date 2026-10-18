// tests/bbip-context.test.ts
import { describe, expect, it } from "vitest";
import type { CodexEntry } from "../lib/codex/types";
import { buildTurnContext, selectPromptNotes } from "../lib/bbip/context";
import { BBIP_SOURCE_PREFIX, buildPriorTurnsBlock } from "../lib/bbip/prompts";
import type { BbipSession, BbipTurn } from "../lib/bbip/types";

function entry(overrides: Partial<CodexEntry>): CodexEntry {
  return {
    id: "e1",
    title: "피코토닝 기미",
    content: "저출력 반복 조사.",
    categoryKey: "pico-toning",
    tier: "procedure_tip",
    tags: [],
    sources: [{ id: "s1", type: "book", citation: "교과서" }],
    relatedEntryIds: [],
    status: "reviewed",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    contentVersion: 1,
    claims: [],
    ...overrides,
  };
}

const session: BbipSession = {
  id: "s",
  chips: { patient: ["40대 여성"], conditions: ["기미"], meds: ["아스피린"], procedures: ["피코토닝"] },
  flags: [{ level: "caution", text: "항응고 주의", source: "rule" }],
  sourceNoteIds: ["e1", "gone", "e2"],
  promptVersion: "bbip-v1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const entries = [
  entry({ id: "e1" }),
  entry({
    id: "e2",
    title: "BBIP 초안",
    status: "draft",
    sources: [{ id: "s2", type: "other", citation: `${BBIP_SOURCE_PREFIX} · fake · 2026-10-18` }],
  }),
];

function textOf(block: unknown): string {
  return (block as { text: string }).text;
}

describe("selectPromptNotes", () => {
  it("keeps citation numbers stable when a note was deleted and marks BBIP drafts unverified", () => {
    const notes = selectPromptNotes(session, entries);
    expect(notes.map((n) => [n.n, n.entry.id, n.verified])).toEqual([
      [1, "e1", true],
      [3, "e2", false],
    ]);
  });
});

describe("buildTurnContext", () => {
  it("keeps the cached prefix byte-identical across turns of one session", () => {
    const brief = buildTurnContext({ session, entries, priorTurns: [], request: { kind: "brief" } });
    const ddx = buildTurnContext({
      session,
      entries,
      priorTurns: [],
      request: { kind: "section", sectionKey: "ddx" },
    });
    expect(brief.system).toEqual(ddx.system);
    const [briefStable, briefVolatile] = brief.messages[0]!.content as unknown[];
    const [ddxStable, ddxVolatile] = ddx.messages[0]!.content as unknown[];
    expect(briefStable).toEqual(ddxStable);
    expect(textOf(briefVolatile)).toContain("<followups>");
    expect(textOf(ddxVolatile)).toContain("감별질환");
  });

  it("puts flags and verified attributes in the stable block", () => {
    const ctx = buildTurnContext({ session, entries, priorTurns: [], request: { kind: "brief" } });
    const stable = textOf((ctx.messages[0]!.content as unknown[])[0]);
    expect(stable).toContain("[주의] 항응고 주의");
    expect(stable).toContain('<note n="3" title="BBIP 초안" verified="false">');
    expect(ctx.noteRefs.map((r) => r.n)).toEqual([1, 3]);
  });
});

describe("buildPriorTurnsBlock", () => {
  it("includes the brief and first paragraphs, capped", () => {
    const turn = (over: Partial<BbipTurn>): BbipTurn => ({
      id: "t",
      sessionId: "s",
      kind: "brief",
      output: "",
      followups: [],
      model: "fake",
      status: "done",
      createdAt: "",
      ...over,
    });
    const block = buildPriorTurnsBlock([
      turn({ output: "- 브리핑 줄" }),
      turn({ kind: "section", sectionKey: "ddx", output: "첫 문단\n\n둘째 문단" }),
      turn({ kind: "custom", question: "q", output: "x".repeat(5000) }),
      turn({ kind: "custom", question: "실패", output: "zzz", status: "failed" }),
    ]);
    expect(block).toContain("[⚡ 핵심 브리핑]\n- 브리핑 줄");
    expect(block).toContain("[🔍 감별질환]\n첫 문단");
    expect(block).not.toContain("둘째 문단");
    expect(block).not.toContain("zzz");
    expect(block.length).toBeLessThan(3200);
  });
});
