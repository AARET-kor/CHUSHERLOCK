// tests/ask.test.ts
import { describe, expect, it } from "vitest";
import { buildAskSystemPrompt, buildAskUserPrompt } from "../lib/ai/ask";
import type { CodexEntry } from "../lib/codex/types";
import { BBIP_SOURCE_PREFIX } from "../lib/bbip/prompts";

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

describe("ask prompts", () => {
  it("marks BBIP drafts as unverified in the note tag", () => {
    const prompt = buildAskUserPrompt("기미 토닝?", [
      { note: entry({ id: "ok" }), score: 2 },
      {
        note: entry({
          id: "draft",
          title: "BBIP 초안",
          status: "draft",
          sources: [{ id: "s2", type: "other", citation: `${BBIP_SOURCE_PREFIX} · fake · 2026-10-18` }],
        }),
        score: 1,
      },
    ]);
    expect(prompt).toMatch(/<note n="1" title="피코토닝 기미" category="[^"]+">/);
    expect(prompt).toMatch(/<note n="2" title="BBIP 초안" category="[^"]+" verified="false">/);
  });

  it("tells the model unverified drafts are not the doctor's own notes", () => {
    const system = buildAskSystemPrompt();
    expect(system).toContain('verified="false"');
    expect(system).toContain("(검토 전 AI 초안)");
  });
});
