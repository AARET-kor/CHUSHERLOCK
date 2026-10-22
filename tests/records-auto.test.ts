// tests/records-auto.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ParsedCase } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let auto: typeof import("../lib/records/autoRecord");
let records: typeof import("../lib/services/recordsService");
let bbip: typeof import("../lib/services/bbipService");

beforeAll(async () => {
  env = await setupTempDb("records-auto");
  auto = await import("../lib/records/autoRecord");
  records = await import("../lib/services/recordsService");
  bbip = await import("../lib/services/bbipService");
});
afterAll(() => env.cleanup());

const chips = (procedures: string[]): ParsedCase => ({ patient: ["40대 여성"], conditions: ["기미"], meds: [], procedures });
const finishBrief = (sessionId: string, output: string) => {
  const turn = bbip.startTurn(sessionId, { kind: "brief" }, "fake");
  bbip.finishTurn(turn.id, output, []);
};

describe("auto record", () => {
  it("turns the brief into plain result text", () => {
    expect(auto.briefResult("- ==캐뉼라== 우선 [AI]\n- !!괴사!! 주의 [1]\n<followups>[\"q\"]</followups>")).toBe(
      "- **캐뉼라** 우선 (AI 보충)\n- **괴사** 주의"
    );
  });

  it("creates one visit per linked consult and continues the course", () => {
    const p = records.createPatient({ chartNo: "AUTO-1", alias: "", features: "", memo: "" });
    const s1 = bbip.createSession({ chips: chips(["피코토닝"]), flags: [], sourceNoteIds: [], patientId: p.id });
    const v1 = auto.ensureSessionVisit(s1.id, "2026-10-01")!;
    expect(v1).toMatchObject({ kind: "baseline", sessionNo: null, date: "2026-10-01", sessionId: s1.id, result: "" });
    expect(auto.ensureSessionVisit(s1.id)?.id).toBe(v1.id);
    const course = records.getCourse(v1.courseId)!;
    expect(course).toMatchObject({ procedure: "피코토닝", indication: "기미", startedAt: "2026-10-01" });

    records.updateVisit(v1.id, { params: "1064nm 2.5J" });
    const s2 = bbip.createSession({ chips: chips(["피코토닝 1회차"]), flags: [], sourceNoteIds: [], patientId: p.id });
    const v2 = auto.ensureSessionVisit(s2.id, "2026-10-08")!;
    expect(v2).toMatchObject({ courseId: course.id, kind: "session", sessionNo: 1, params: "1064nm 2.5J" });
  });

  it("saves the brief as the visit result, also when the patient is linked later", () => {
    const p = records.createPatient({ chartNo: "AUTO-2", alias: "", features: "", memo: "" });
    const s1 = bbip.createSession({ chips: chips(["필러"]), flags: [], sourceNoteIds: [], patientId: p.id });
    auto.ensureSessionVisit(s1.id);
    auto.recordBriefResult(s1.id, "- 캐뉼라 우선 [AI]");
    expect(records.visitForSession(s1.id)?.result).toBe("- 캐뉼라 우선 (AI 보충)");

    const late = bbip.createSession({ chips: chips(["필러"]), flags: [], sourceNoteIds: [] });
    finishBrief(late.id, "- 이미 쓴 브리핑 [AI]");
    auto.recordBriefResult(late.id, "- 무시됨");
    expect(records.visitForSession(late.id)).toBeNull();
    records.linkSessionPatient(late.id, p.id);
    expect(auto.ensureSessionVisit(late.id)?.result).toBe("- 이미 쓴 브리핑 (AI 보충)");
  });

  it("skips consults without a procedure or a patient", () => {
    const p = records.createPatient({ chartNo: "AUTO-3", alias: "", features: "", memo: "" });
    const none = bbip.createSession({ chips: chips([]), flags: [], sourceNoteIds: [], patientId: p.id });
    expect(auto.ensureSessionVisit(none.id)).toBeNull();
    const unlinked = bbip.createSession({ chips: chips(["필러"]), flags: [], sourceNoteIds: [] });
    expect(auto.ensureSessionVisit(unlinked.id)).toBeNull();
  });

  it("preserves the visit and course on unlink", () => {
    const p = records.createPatient({ chartNo: "AUTO-4", alias: "", features: "", memo: "" });
    const s1 = bbip.createSession({ chips: chips(["보톡스"]), flags: [], sourceNoteIds: [], patientId: p.id });
    const v1 = auto.ensureSessionVisit(s1.id)!;
    records.updateVisit(v1.id, { note: "보존할 메모" });
    const photo = records.addPhoto({ visitId: v1.id, angle: "front", file: "kept.jpg", thumb: "kept-thumb.jpg", width: 1, height: 1 });
    auto.removeSessionVisit(s1.id);
    expect(records.getVisit(v1.id)?.note).toBe("보존할 메모");
    expect(records.getPhoto(photo.id)).not.toBeNull();
    expect(records.getVisit(v1.id)?.sessionId).toBeNull();
    expect(records.getVisit(v1.id)).not.toBeNull();
    expect(records.getCourse(v1.courseId)).not.toBeNull();

    const s2 = bbip.createSession({ chips: chips(["보톡스"]), flags: [], sourceNoteIds: [], patientId: p.id });
    const kept = auto.ensureSessionVisit(s2.id)!;
    const s3 = bbip.createSession({ chips: chips(["보톡스"]), flags: [], sourceNoteIds: [], patientId: p.id });
    auto.ensureSessionVisit(s3.id);
    auto.removeSessionVisit(s3.id);
    expect(records.getCourse(kept.courseId)).not.toBeNull();
    expect(records.getVisit(kept.id)).not.toBeNull();
  });
});
