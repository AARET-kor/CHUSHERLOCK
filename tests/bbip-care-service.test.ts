// tests/bbip-care-service.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CareItem } from "../lib/bbip/care/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let bbip: typeof import("../lib/services/bbipService");
let care: typeof import("../lib/services/careService");

beforeAll(async () => {
  env = await setupTempDb("bbip-care-service");
  bbip = await import("../lib/services/bbipService");
  care = await import("../lib/services/careService");
});
afterAll(() => env.cleanup());

const chips = { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝"] };
const row = (over: Partial<CareItem> = {}): CareItem => ({
  id: crypto.randomUUID(),
  kind: "dressing",
  fields: { material: "재생크림", method: "얇게", interval: "", duration: "" },
  patientText: "얇게 바르세요.",
  source: "ai",
  confirmed: false,
  ...over,
});
const newOrder = (sessionId: string, items: CareItem[]) =>
  care.saveCareOrder({ sessionId, items, setKeys: [], caution: "", notices: [], model: "fake" });

describe("careService", () => {
  it("keeps one order per session and replaces it", () => {
    const session = bbip.createSession({ chips, flags: [], sourceNoteIds: [] });
    expect(care.getCareOrder(session.id)).toBeNull();
    const first = newOrder(session.id, [row()]);
    expect(care.getCareOrder(session.id)).toEqual(first);
    const second = care.saveCareOrder({
      sessionId: session.id,
      items: [row(), row()],
      setKeys: ["피코토닝"],
      caution: "주의",
      notices: ["알림"],
      model: "fake",
    });
    expect(second.id).not.toBe(first.id);
    expect(care.getCareOrderById(first.id)).toBeNull();
    expect(care.getCareOrder(session.id)).toMatchObject({ caution: "주의", notices: ["알림"], setKeys: ["피코토닝"] });
  });

  it("updates rows and bumps updatedAt", async () => {
    const session = bbip.createSession({ chips, flags: [], sourceNoteIds: [] });
    const order = newOrder(session.id, [row()]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = care.updateCareItems(order.id, [row({ confirmed: true })]);
    expect(updated?.items[0]?.confirmed).toBe(true);
    expect(updated!.updatedAt > order.updatedAt).toBe(true);
    expect(care.updateCareItems("missing", [])).toBeNull();
  });

  it("deletes the order with its session", () => {
    const session = bbip.createSession({ chips, flags: [], sourceNoteIds: [] });
    const order = newOrder(session.id, [row()]);
    env.sqliteClient.prepare("DELETE FROM bbip_sessions WHERE id = ?").run(session.id);
    expect(care.getCareOrderById(order.id)).toBeNull();
  });

  it("upserts sets by normalized procedure and finds them for chips", () => {
    const a = care.saveCareSet({ label: "피코 토닝", items: [row({ source: "set" })] });
    const b = care.saveCareSet({ label: "피코토닝", items: [row({ source: "set" }), row({ source: "set" })], sourceSessionId: "s1" });
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({ label: "피코토닝", procedureKey: "피코토닝", sourceSessionId: "s1" });
    expect(care.getCareSetsFor(["울쎄라", "피코토닝"]).map((s) => s.items.length)).toEqual([2]);
    expect(care.listCareSets().map((s) => s.procedureKey)).toContain("피코토닝");
    expect(care.deleteCareSet(a.id)).toBe(true);
    expect(care.deleteCareSet(a.id)).toBe(false);
    expect(care.getCareSetsFor(["피코토닝"])).toEqual([]);
  });
});
