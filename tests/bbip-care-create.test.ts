// tests/bbip-care-create.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CareItem } from "../lib/bbip/care/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let bbip: typeof import("../lib/services/bbipService");
let care: typeof import("../lib/services/careService");
let create: typeof import("../lib/bbip/care/createCareOrder");

beforeAll(async () => {
  env = await setupTempDb("bbip-care-create");
  bbip = await import("../lib/services/bbipService");
  care = await import("../lib/services/careService");
  create = await import("../lib/bbip/care/createCareOrder");
});
afterAll(() => env.cleanup());

const BLANK = {
  drug: "", brand: "", form: "", dose: "", frequency: "", duration: "", purpose: "",
  material: "", method: "", interval: "", situation: "", signs: "", action: "", resolution: "",
  urgency: "", day: 0, when: "", checks: "", next: "", patientText: "", cite: "AI",
};
const rxRow = (drug: string): CareItem => ({
  id: crypto.randomUUID(),
  kind: "rx",
  fields: { drug, brand: "", form: "100 mg 캡슐", dose: "1캡슐", frequency: "1일 2회", duration: "7일", purpose: "" },
  patientText: "",
  source: "set",
  confirmed: false,
});
const dressingRow: CareItem = {
  id: "d",
  kind: "dressing",
  fields: { material: "재생크림", method: "얇게", interval: "", duration: "" },
  patientText: "",
  source: "set",
  confirmed: false,
};

function newSession(procedure: string, conditions: string[] = ["기미"]) {
  return bbip.createSession({
    chips: { patient: [], conditions, meds: [], procedures: [procedure] },
    flags: [],
    sourceNoteIds: [],
  });
}

function reply(body: object) {
  return vi.fn(async () => ({ text: JSON.stringify(body), model: "claude-opus-5-5", stopReason: "end_turn" }));
}

describe("createCareOrder", () => {
  it("drafts from the model when no set exists", async () => {
    const session = newSession("시술A");
    const generate = reply({
      caution: "주의 한 줄",
      items: [{ ...BLANK, kind: "dressing", material: "거즈", method: "덮기" }, { ...BLANK, kind: "bogus" }],
      remove: [],
    });
    const order = await create.createCareOrder(session.id, { listEntries: async () => [], generate });
    expect(generate).toHaveBeenCalledWith(expect.anything(), []);
    expect(order).toMatchObject({ sessionId: session.id, caution: "주의 한 줄", model: "claude-opus-5-5", setKeys: [] });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ source: "ai", confirmed: false });
    expect(order.notices).toEqual(["형식이 맞지 않는 1개 행을 뺐습니다."]);
    expect(care.getCareOrder(session.id)?.id).toBe(order.id);
  });

  it("starts from the saved set, pre-confirms clean rows and applies removals and additions", async () => {
    care.saveCareSet({ label: "시술B", items: [rxRow("doxycycline"), dressingRow, rxRow("cefadroxil")] });
    const session = newSession("시술B", ["임신 10주"]);
    const generate = vi.fn(async (_context: unknown, seed: CareItem[]) => ({
      text: JSON.stringify({
        caution: "",
        items: [
          { ...BLANK, kind: "dressing", material: "재생크림 ", method: "중복" },
          { ...BLANK, kind: "followup", day: 7, when: "D+7", checks: "홍반" },
        ],
        remove: [{ id: seed.find((row) => row.fields.drug === "cefadroxil")!.id, reason: "필요 없음" }],
      }),
      model: "claude-opus-5-5",
      stopReason: "end_turn",
    }));
    const order = await create.createCareOrder(session.id, { listEntries: async () => [], generate });
    expect(order.setKeys).toEqual(["시술b"]);
    const byPrimary = (value: string) =>
      order.items.find((item) => Object.values(item.fields).includes(value))!;
    // Pregnancy trips the tetracycline rule → stays unconfirmed for review.
    expect(byPrimary("doxycycline")).toMatchObject({ source: "set", confirmed: false });
    expect(byPrimary("재생크림")).toMatchObject({ source: "set", confirmed: true });
    expect(byPrimary("cefadroxil")).toMatchObject({ removed: { reason: "필요 없음" }, confirmed: false });
    expect(byPrimary("D+7")).toMatchObject({ source: "ai", confirmed: false });
    // The duplicate dressing from the model is dropped in favour of the set row.
    expect(order.items.filter((item) => item.kind === "dressing")).toHaveLength(1);
  });

  it("falls back to the set alone when the model fails", async () => {
    care.saveCareSet({ label: "시술C", items: [dressingRow] });
    const session = newSession("시술C");
    const order = await create.createCareOrder(session.id, {
      listEntries: async () => [],
      generate: vi.fn(async () => {
        throw new Error("overloaded");
      }),
    });
    expect(order.model).toBe("set");
    expect(order.notices).toEqual(["AI 조정에 실패해 내 세트만 표시합니다."]);
    expect(order.items).toHaveLength(1);
  });

  it("fails without a set when the model fails, or when nothing was produced", async () => {
    const session = newSession("시술D");
    await expect(
      create.createCareOrder(session.id, {
        listEntries: async () => [],
        generate: vi.fn(async () => {
          throw new Error("down");
        }),
      })
    ).rejects.toThrow("down");
    await expect(
      create.createCareOrder(session.id, { listEntries: async () => [], generate: reply({ caution: "", items: [], remove: [] }) })
    ).rejects.toThrow("오더 행을 만들지 못했습니다.");
    await expect(create.createCareOrder("missing")).rejects.toBeInstanceOf(create.CareNotFoundError);
  });
});
