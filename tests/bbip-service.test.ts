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

async function makeEntry() {
  const [{ createEntrySchema }, entryService] = await Promise.all([
    import("../lib/schemas/entrySchemas"),
    import("../lib/services/entryService"),
  ]);
  const created = await entryService.createEntry(
    createEntrySchema.parse({
      title: "승격 노트",
      content: "임상적으로 의미 있는 테스트 내용입니다. 수치 10 mg을 기록합니다.",
      categoryKey: "botox",
      tier: "deep_study",
      tags: [],
      sources: [{ type: "paper", citation: `출처 ${crypto.randomUUID()}` }],
      relatedEntryIds: [],
      figureIds: [],
      claims: [],
      status: "draft",
    })
  );
  return created.entry;
}

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

  it("tracks a turn from streaming to done, failed and promoted", async () => {
    const session = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    const turn = service.startTurn(session.id, { kind: "section", sectionKey: "ddx" }, "fake");
    expect(turn).toMatchObject({ status: "streaming", output: "", sectionKey: "ddx", followups: [] });

    service.finishTurn(turn.id, "본문", ["q1"]);
    expect(service.getTurn(turn.id)).toMatchObject({ status: "done", output: "본문", followups: ["q1"] });

    const failed = service.startTurn(session.id, { kind: "custom", question: "질문" }, "fake");
    service.failTurn(failed.id, "부분", "boom");
    expect(service.getTurn(failed.id)).toMatchObject({ status: "failed", output: "부분", error: "boom" });

    const [first, second] = [await makeEntry(), await makeEntry()];
    expect(service.markPromoted(turn.id, first.id)).toBe(true);
    expect(service.getTurn(turn.id)?.promotedEntryId).toBe(first.id);
    expect(service.markPromoted(turn.id, second.id)).toBe(false);
    expect(service.getTurn(turn.id)?.promotedEntryId).toBe(first.id);
    expect(service.listTurns(session.id).map((t) => t.id)).toEqual([turn.id, failed.id]);
  });

  it("does not overwrite a turn that is no longer streaming", () => {
    const session = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    const turn = service.startTurn(session.id, { kind: "brief" }, "fake");
    service.finishTurn(turn.id, "완료", []);
    service.failTurn(turn.id, "늦은 실패", "late");
    expect(service.getTurn(turn.id)).toMatchObject({ status: "done", output: "완료" });
    service.finishTurn(turn.id, "덮어쓰기", ["x"]);
    expect(service.getTurn(turn.id)).toMatchObject({ output: "완료", followups: [] });
  });

  it("fails stale streaming turns only", () => {
    const session = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    const stale = service.startTurn(session.id, { kind: "brief" }, "fake");
    const fresh = service.startTurn(session.id, { kind: "brief" }, "fake");
    env.sqliteClient
      .prepare("UPDATE bbip_turns SET created_at = ? WHERE id = ?")
      .run(new Date(Date.now() - 40 * 60_000).toISOString(), stale.id);
    expect(service.failStaleTurns()).toBeGreaterThanOrEqual(1);
    expect(service.getTurn(stale.id)).toMatchObject({ status: "failed", error: "interrupted" });
    expect(service.getTurn(fresh.id)?.status).toBe("streaming");
  });

  it("orders same-millisecond sessions newest first via rowid", () => {
    const a = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    const b = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    env.sqliteClient.prepare("UPDATE bbip_sessions SET created_at = ? WHERE id IN (?, ?)").run(
      "2099-01-01T00:00:00.000Z", a.id, b.id
    );
    const ids = service.listSessions(2).map((s) => s.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it("clears promotedEntryId when the promoted entry is deleted", async () => {
    const entry = await makeEntry();
    const session = service.createSession({ chips, flags: [], sourceNoteIds: [] });
    const turn = service.startTurn(session.id, { kind: "brief" }, "fake");
    expect(service.markPromoted(turn.id, entry.id)).toBe(true);
    expect(service.getTurn(turn.id)?.promotedEntryId).toBe(entry.id);
    env.sqliteClient.prepare("DELETE FROM entries WHERE id = ?").run(entry.id);
    expect(service.getTurn(turn.id)?.promotedEntryId).toBeUndefined();
  });
});
