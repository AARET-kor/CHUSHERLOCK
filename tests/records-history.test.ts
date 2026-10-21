// tests/records-history.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PatientRecord } from "../lib/records/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let history: typeof import("../lib/records/history");
let context: typeof import("../lib/bbip/context");
let runTurnMod: typeof import("../lib/bbip/runTurn");
let records: typeof import("../lib/services/recordsService");
let bbip: typeof import("../lib/services/bbipService");

beforeAll(async () => {
  env = await setupTempDb("records-history");
  history = await import("../lib/records/history");
  context = await import("../lib/bbip/context");
  runTurnMod = await import("../lib/bbip/runTurn");
  records = await import("../lib/services/recordsService");
  bbip = await import("../lib/services/bbipService");
});
afterAll(() => env.cleanup());

const visit = (over: Record<string, unknown>) => ({
  id: crypto.randomUUID(), courseId: "c1", date: "2026-09-01", kind: "session", sessionNo: 1, product: "", params: "",
  note: "환자 김OO 010-1234-5678", gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null, sessionId: null,
  createdAt: "", photos: [], ...over,
});

const record: PatientRecord = {
  patient: { id: "p1", chartNo: "20431", alias: "KJ-40여", features: "40대 여성 · 기미", memo: "VIP", createdAt: "", updatedAt: "" },
  courses: [
    {
      id: "c1", patientId: "p1", procedure: "피코토닝", indication: "기미", plannedSessions: 20, scoreKind: "mmasi",
      status: "active", startedAt: "2026-09-01", createdAt: "",
      visits: [
        visit({ kind: "baseline", sessionNo: null, score: 18 }) as never,
        visit({ date: "2026-09-20", sessionNo: 5, score: 11, gaisDoctor: 3, product: "PicoSure", params: "1064nm 2.8J/cm²" }) as never,
        visit({ date: "2026-10-14", sessionNo: 10, score: 7, gaisDoctor: 2, params: "1064nm 3.0J/cm² 8mm" }) as never,
      ],
    },
  ],
};

describe("buildHistoryBlock", () => {
  it("states clinical facts only", () => {
    const block = history.buildHistoryBlock(record);
    expect(block).toContain("<history>");
    expect(block).toContain("피코토닝 · 기미");
    expect(block).toContain("2회 시행 / 계획 20회");
    expect(block).toContain("18 → 11 → 7");
    expect(block).toContain("1064nm 3.0J/cm² 8mm");
    expect(block).toContain("GAIS(원장) 추이: 3 → 2");
    for (const secret of ["20431", "KJ-40여", "40대 여성", "VIP", "김OO", "010-1234"]) expect(block).not.toContain(secret);
  });

  it("is empty without courses", () => {
    expect(history.buildHistoryBlock(null)).toBe("");
    expect(history.buildHistoryBlock({ ...record, courses: [] })).toBe("");
  });
});

describe("history in turns", () => {
  it("puts the block in the stable prompt prefix", () => {
    const session = { id: "s", chips: { patient: [], conditions: [], meds: [], procedures: ["피코토닝"] }, flags: [], sourceNoteIds: [], promptVersion: "x", createdAt: "" };
    const ctx = context.buildTurnContext({ session, entries: [], priorTurns: [], request: { kind: "brief" }, history: "<history>\n- X\n</history>" });
    const first = ctx.messages[0]!.content as Array<{ text: string }>;
    expect(first[0]!.text).toContain("<history>");
  });

  it("runTurn passes the linked patient's history to the generator", async () => {
    const p = records.createPatient({ chartNo: "H-1", alias: "", features: "", memo: "" });
    const c = records.createCourse({ patientId: p.id, procedure: "피코토닝", indication: "", plannedSessions: null, scoreKind: "none", startedAt: "2026-10-01" });
    records.createVisit({ courseId: c.id, date: "2026-10-01", kind: "session", sessionNo: 1, product: "", params: "2.5J", note: "", gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null, sessionId: null });
    const session = bbip.createSession({ chips: { patient: [], conditions: [], meds: [], procedures: ["피코토닝"] }, flags: [], sourceNoteIds: [], patientId: p.id });
    let seen = "";
    const events = runTurnMod.runTurn(session.id, { kind: "brief" }, {
      listEntries: async () => [],
      generate: async function* (args) {
        seen = args.history ?? "";
        yield "- 답 [AI]";
      },
    });
    for await (const _ of events) void _;
    expect(seen).toContain("2.5J");
  });
});
