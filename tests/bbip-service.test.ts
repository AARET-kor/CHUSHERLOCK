// tests/bbip-service.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let service: typeof import("../lib/services/bbipService");

const chips = { patient: ["40대 여성"], conditions: ["기미"], meds: [], procedures: ["피코토닝"] };

beforeAll(async () => {
  env = await setupTempDb("bbip-service");
  service = await import("../lib/services/bbipService");
});
afterAll(() => env.cleanup());

describe("bbipService", () => {
  it("creates, reads and lists sessions newest first", async () => {
    const first = service.createSession({ chips, flags: [], sourceNoteIds: ["n1"] });
    await new Promise((r) => setTimeout(r, 5));
    const second = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    expect(service.getSession(first.id)).toEqual(first);
    expect(first.promptVersion).toBe("bbip-v1");
    const listed = service.listSessions(10).map((s) => s.id);
    expect(listed.indexOf(second.id)).toBeLessThan(listed.indexOf(first.id));
    expect(service.getSession("missing")).toBeNull();
  });

  it("tracks a turn from streaming to done, failed and promoted", () => {
    const session = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    const turn = service.startTurn(session.id, { kind: "section", sectionKey: "ddx" }, "fake");
    expect(turn).toMatchObject({ status: "streaming", output: "", sectionKey: "ddx", followups: [] });

    service.finishTurn(turn.id, "본문", ["q1"]);
    expect(service.getTurn(turn.id)).toMatchObject({ status: "done", output: "본문", followups: ["q1"] });

    const failed = service.startTurn(session.id, { kind: "custom", question: "질문" }, "fake");
    service.failTurn(failed.id, "부분", "boom");
    expect(service.getTurn(failed.id)).toMatchObject({ status: "failed", output: "부분", error: "boom" });

    service.markPromoted(turn.id, "entry-1");
    expect(service.getTurn(turn.id)?.promotedEntryId).toBe("entry-1");
    expect(service.listTurns(session.id).map((t) => t.id)).toEqual([turn.id, failed.id]);
  });
});
