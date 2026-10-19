// tests/bbip-console-state.test.ts
import { describe, expect, it } from "vitest";
import { consoleReducer, hasDetachedStreaming, initialConsoleState } from "../lib/bbip/consoleState";
import { chipSummary } from "../lib/bbip/format";
import type { SessionView } from "../lib/bbip/types";

const view: SessionView = {
  session: {
    id: "s",
    chips: { patient: ["40대 여성"], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
    flags: [],
    sourceNoteIds: [],
    promptVersion: "bbip-v2",
    createdAt: "2026-10-18T00:00:00.000Z",
  },
  turns: [
    {
      id: "t0",
      sessionId: "s",
      kind: "brief",
      output: "브리핑",
      followups: ["q"],
      model: "fake",
      status: "done",
      createdAt: "",
    },
  ],
  notes: [],
};

describe("consoleReducer", () => {
  it("a literature event attaches the block to the session", () => {
    const block = { pubmedQuery: "q", webQuery: "w", papers: [], web: [], errors: {}, fetchedAt: "" };
    let state = initialConsoleState(view);
    state = consoleReducer(state, { type: "turn-start", key: "k", request: { kind: "literature" } });
    state = consoleReducer(state, { type: "turn-event", key: "k", event: { type: "literature", block } });
    expect(state.session?.literature).toEqual(block);
    expect(state.turns.find((t) => t.key === "k")).toMatchObject({ kind: "literature", status: "streaming", output: "" });
  });

  it("hydrates from a server view", () => {
    const state = initialConsoleState(view);
    expect(state.session?.id).toBe("s");
    expect(state.turns[0]).toMatchObject({ key: "t0", id: "t0", status: "done", followups: ["q"] });
    expect(initialConsoleState(null).session).toBeNull();
  });

  it("applies a full stream of events to one card", () => {
    let state = initialConsoleState(view);
    state = consoleReducer(state, { type: "turn-start", key: "k1", request: { kind: "section", sectionKey: "ddx" } });
    state = consoleReducer(state, { type: "turn-event", key: "k1", event: { type: "start", turnId: "T1" } });
    state = consoleReducer(state, { type: "turn-event", key: "k1", event: { type: "delta", text: "가" } });
    state = consoleReducer(state, { type: "turn-event", key: "k1", event: { type: "delta", text: "나" } });
    state = consoleReducer(state, { type: "turn-event", key: "k1", event: { type: "done", turnId: "T1" } });
    expect(state.turns[1]).toMatchObject({ id: "T1", output: "가나", status: "done", sectionKey: "ddx" });
  });

  it("marks failures, removes cards, and records promotion", () => {
    let state = initialConsoleState(view);
    state = consoleReducer(state, { type: "turn-start", key: "k2", request: { kind: "custom", question: "q" } });
    state = consoleReducer(state, { type: "turn-event", key: "k2", event: { type: "error", message: "boom" } });
    expect(state.turns[1]).toMatchObject({ status: "failed", error: "boom" });
    state = consoleReducer(state, { type: "turn-remove", key: "k2" });
    expect(state.turns).toHaveLength(1);
    state = consoleReducer(state, { type: "promoted", turnId: "t0", entryId: "e" });
    expect(state.turns[0]!.promotedEntryId).toBe("e");
  });

  it("syncs detached streaming cards from a server snapshot", () => {
    const streamingView: SessionView = {
      ...view,
      turns: [{ ...view.turns[0]!, status: "streaming", output: "부분" }],
    };
    let state = initialConsoleState(streamingView);
    expect(hasDetachedStreaming(state)).toBe(true);
    state = consoleReducer(state, { type: "sync", turns: [{ ...view.turns[0]!, output: "완성" }] });
    expect(state.turns[0]).toMatchObject({ status: "done", output: "완성" });
    expect(hasDetachedStreaming(state)).toBe(false);
  });

  it("drops failed turns superseded by a later turn of the same request", () => {
    const failed = { ...view.turns[0]!, id: "t-bad", status: "failed" as const, output: "", error: "x" };
    const superseded: SessionView = { ...view, turns: [failed, { ...view.turns[0]!, id: "t-ok" }] };
    const state = initialConsoleState(superseded);
    expect(state.turns.map((t) => t.id)).toEqual(["t-ok"]);
    // A failed turn with no later retry is kept so the user can retry it.
    expect(initialConsoleState({ ...view, turns: [failed] }).turns).toHaveLength(1);
  });

  it("ignores events for an unknown key after reset", () => {
    let state = initialConsoleState(view);
    state = consoleReducer(state, { type: "reset", view, degraded: false });
    const next = consoleReducer(state, { type: "turn-event", key: "gone", event: { type: "delta", text: "x" } });
    expect(next.turns).toEqual(state.turns);
  });

  it("resets to a new session", () => {
    const state = consoleReducer(initialConsoleState(null), { type: "reset", view, degraded: true });
    expect(state).toMatchObject({ degraded: true, session: { id: "s" } });
  });
});

describe("chipSummary", () => {
  it("leads with procedures and conditions", () => {
    expect(chipSummary(view.session.chips)).toBe("피코토닝 · 기미 · 40대 여성");
  });
});
