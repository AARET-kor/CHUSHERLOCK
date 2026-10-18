// tests/bbip-run-turn.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StreamEvent } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let service: typeof import("../lib/services/bbipService");
let runTurnModule: typeof import("../lib/bbip/runTurn");

beforeAll(async () => {
  env = await setupTempDb("bbip-run-turn");
  service = await import("../lib/services/bbipService");
  runTurnModule = await import("../lib/bbip/runTurn");
});
afterAll(() => env.cleanup());

async function collect(iter: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of iter) events.push(event);
  return events;
}

function newSession() {
  return service.createSession({
    chips: { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
    flags: [{ level: "caution", text: "항응고 주의", source: "rule" }],
    sourceNoteIds: [],
  });
}

describe("runTurn", () => {
  it("streams a fake brief, strips followups, and stores the turn", async () => {
    const session = newSession();
    const events = await collect(runTurnModule.runTurn(session.id, { kind: "brief" }));
    expect(events[0]?.type).toBe("start");
    expect(events.at(-1)?.type).toBe("done");
    const followups = events.find((e) => e.type === "followups");
    expect(followups).toEqual({
      type: "followups",
      items: ["피코토닝 감별 포인트는?", "피코토닝 시술 간격은?", "재발 시 설명 멘트"],
    });
    const text = events.flatMap((e) => (e.type === "delta" ? [e.text] : [])).join("");
    expect(text).toContain("[FAKE 모드]");
    expect(text).not.toContain("<followups>");
    const [turn] = service.listTurns(session.id);
    expect(turn).toMatchObject({ kind: "brief", status: "done", model: "fake" });
    expect(turn!.output).not.toContain("followups");
  });

  it("records partial output and fails the turn when generation throws", async () => {
    const session = newSession();
    async function* broken(): AsyncGenerator<string> {
      yield "부분";
      throw new Error("boom");
    }
    const events = await collect(
      runTurnModule.runTurn(
        session.id,
        { kind: "custom", question: "질문" },
        { listEntries: async () => [], generate: broken }
      )
    );
    expect(events.at(-1)).toEqual({ type: "error", message: "생성 실패: boom" });
    expect(service.listTurns(session.id)[0]).toMatchObject({
      status: "failed",
      output: "부분",
      error: "boom",
    });
  });

  it("errors for an unknown session without creating a turn", async () => {
    const events = await collect(runTurnModule.runTurn("missing", { kind: "brief" }));
    expect(events).toEqual([{ type: "error", message: "세션을 찾을 수 없습니다." }]);
  });
});
