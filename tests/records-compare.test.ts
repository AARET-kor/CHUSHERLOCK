// tests/records-compare.test.ts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CourseRecord, Patient } from "../lib/records/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let facts: typeof import("../lib/records/compareFacts");
let ai: typeof import("../lib/records/compareAi");
let records: typeof import("../lib/services/recordsService");
let compareRoute: typeof import("../app/api/records/compare/route");
let mergeRoute: typeof import("../app/api/records/visits/[id]/merge-analysis/route");

beforeAll(async () => {
  env = await setupTempDb("records-compare");
  facts = await import("../lib/records/compareFacts");
  ai = await import("../lib/records/compareAi");
  records = await import("../lib/services/recordsService");
  compareRoute = await import("../app/api/records/compare/route");
  mergeRoute = await import("../app/api/records/visits/[id]/merge-analysis/route");
});
afterAll(() => env.cleanup());

const patient: Patient = { id: "p", chartNo: "20431", alias: "KJ-40여", features: "40대 여성 · 기미", memo: "VIP", createdAt: "", updatedAt: "" };
const v = (over: Record<string, unknown>) => ({
  id: "v", courseId: "c", date: "2026-09-01", kind: "session", sessionNo: null, product: "", params: "",
  note: "김OO 010-1234-5678", gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null,
  result: "브리핑 원문", sessionId: null, createdAt: "", aiAnalysis: null, photos: [], ...over,
});
const course = {
  id: "c", patientId: "p", procedure: "피코토닝", indication: "기미", plannedSessions: 20, scoreKind: "mmasi",
  status: "active", startedAt: "2026-09-01", createdAt: "",
  visits: [
    v({ id: "a", kind: "baseline", score: 18 }),
    v({ id: "b", date: "2026-09-20", sessionNo: 5, params: "1064nm 2.8J", score: 11 }),
    v({ id: "c2", date: "2026-10-14", sessionNo: 10, product: "PicoSure", params: "1064nm 3.0J 8mm", score: 7, gaisDoctor: 2 }),
  ],
} as unknown as CourseRecord;

describe("compareFacts", () => {
  it("states clinical facts only", () => {
    const text = facts.compareFacts(course, "a", "c2", "front");
    expect(text).toContain("피코토닝 · 기미");
    expect(text).toContain("이전: 2026-09-01 Baseline");
    expect(text).toContain("이후: 2026-10-14 S10 · PicoSure 1064nm 3.0J 8mm");
    expect(text).toContain("사이 회차: 1");
    expect(text).toContain("mMASI 18 → 7");
    expect(text).toContain("각도: 정면");
    for (const secret of [patient.chartNo, patient.alias, patient.features, patient.memo, "김OO", "010-1234", "브리핑 원문"]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("compare AI call", () => {
  it("downscales to a 1024 JPEG and builds a two-image request with the fallback", async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#aa8877" } }).png().toBuffer();
    const small = await ai.imageForAi(big);
    const meta = await sharp(Buffer.from(small, "base64")).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 1024 });
    const params = ai.buildCompareParams({ facts: "FACTS", before: small, after: small }, "claude-sonnet-5-5");
    const content = params.messages[0]!.content as Array<{ type: string; source?: { media_type: string } }>;
    expect(content.filter((b) => b.type === "image")).toHaveLength(2);
    expect(content[1]!.source?.media_type).toBe("image/jpeg");
    expect(params).toMatchObject({ model: "claude-sonnet-5-5", betas: ["server-side-fallback-2026-07-01"] });
  });

  it("turns refusals and truncation into readable errors", async () => {
    const params = ai.buildCompareParams({ facts: "F", before: "x", after: "x" }, "claude-sonnet-5-5");
    await expect(ai.callCompareModel(params, async () => ({ text: "", model: "m", stopReason: "refusal" }))).rejects.toThrow(ai.CompareError);
    await expect(ai.callCompareModel(params, async () => ({ text: "t", model: "m", stopReason: "max_tokens" }))).rejects.toThrow(ai.CompareError);
    await expect(ai.callCompareModel(params, async () => ({ text: " 결과 ", model: "m", stopReason: "end_turn" }))).resolves.toEqual({ text: "결과", model: "m" });
  });
});

describe("compare API (fake mode)", () => {
  it("saves the analysis on the later visit and merges it into the note", async () => {
    const p = records.createPatient({ chartNo: "CMP-1", alias: "", features: "", memo: "" });
    const c = records.createCourse({ patientId: p.id, procedure: "피코토닝", indication: "기미", plannedSessions: null, scoreKind: "none", startedAt: "2026-09-01" });
    const base = { product: "", params: "", note: "", gaisDoctor: null, gaisPatient: null, score: null, nextFuDate: null, sessionId: null };
    const v1 = records.createVisit({ ...base, courseId: c.id, date: "2026-09-01", kind: "baseline", sessionNo: null });
    const v2 = records.createVisit({ ...base, courseId: c.id, date: "2026-10-01", kind: "session", sessionNo: 3, note: "홍반 없음" });
    const dir = process.env.CODEX_PHOTOS_DIR!;
    fs.mkdirSync(dir, { recursive: true });
    const jpg = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#998877" } }).jpeg().toBuffer();
    for (const [visitId, name] of [[v1.id, "p1"], [v2.id, "p2"]] as const) {
      fs.writeFileSync(path.join(dir, `${name}.jpg`), jpg);
      records.addPhoto({ visitId, angle: "front", file: `${name}.jpg`, thumb: `${name}.jpg`, width: 200, height: 200 });
    }
    const post = (body: unknown) =>
      compareRoute.POST(new Request("http://t/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

    expect((await post({ fromVisitId: v1.id, toVisitId: v2.id, angle: "left45" })).status).toBe(400);
    const res = await post({ fromVisitId: v1.id, toVisitId: v2.id, angle: "front" });
    expect(res.status).toBe(200);
    const { visit } = await res.json();
    expect(visit.aiAnalysis).toMatchObject({ fromVisitId: v1.id, angle: "front", model: "fake" });
    expect(visit.aiAnalysis.text).toContain("[FAKE]");

    const merged = await mergeRoute.POST(new Request("http://t/api", { method: "POST" }), { params: Promise.resolve({ id: v2.id }) });
    const after = (await merged.json()).visit;
    expect(after.note).toContain("홍반 없음");
    expect(after.note).toContain("[AI 변화 분석 초안]");
  });
});
