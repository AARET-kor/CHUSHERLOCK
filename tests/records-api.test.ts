// tests/records-api.test.ts
import fs from "node:fs";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let patientsRoute: typeof import("../app/api/records/patients/route");
let patientRoute: typeof import("../app/api/records/patients/[id]/route");
let coursesRoute: typeof import("../app/api/records/courses/route");
let visitsRoute: typeof import("../app/api/records/visits/route");
let visitRoute: typeof import("../app/api/records/visits/[id]/route");
let uploadRoute: typeof import("../app/api/records/visits/[id]/photos/route");
let photoRoute: typeof import("../app/api/records/photos/[id]/route");
let sessionPatientRoute: typeof import("../app/api/bbip/sessions/[id]/patient/route");
let recordRoute: typeof import("../app/api/bbip/sessions/[id]/record/route");

beforeAll(async () => {
  env = await setupTempDb("records-api");
  patientsRoute = await import("../app/api/records/patients/route");
  patientRoute = await import("../app/api/records/patients/[id]/route");
  coursesRoute = await import("../app/api/records/courses/route");
  visitsRoute = await import("../app/api/records/visits/route");
  visitRoute = await import("../app/api/records/visits/[id]/route");
  uploadRoute = await import("../app/api/records/visits/[id]/photos/route");
  photoRoute = await import("../app/api/records/photos/[id]/route");
  sessionPatientRoute = await import("../app/api/bbip/sessions/[id]/patient/route");
  recordRoute = await import("../app/api/bbip/sessions/[id]/record/route");
});
afterAll(() => env.cleanup());

const json = (method: string, body: unknown) =>
  new Request("http://test.local/api", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("records API", () => {
  it("creates, finds, conflicts and edits patients", async () => {
    const created = await patientsRoute.POST(json("POST", { chartNo: "#a-77", alias: "KJ" }));
    expect(created.status).toBe(201);
    const { patient } = await created.json();
    expect(patient.chartNo).toBe("A-77");
    const dup = await patientsRoute.POST(json("POST", { chartNo: "A-77" }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).patientId).toBe(patient.id);
    const found = await patientsRoute.GET(new Request("http://test.local/api?q=kj"));
    expect((await found.json()).patients[0].patient.id).toBe(patient.id);
    const edited = await patientRoute.PATCH(json("PATCH", { features: "40대 여성" }), params(patient.id));
    expect((await edited.json()).patient.features).toBe("40대 여성");
    expect((await patientRoute.GET(new Request("http://test.local/api"), params("nope"))).status).toBe(404);
  });

  it("runs a course → visit → photos → delete flow", async () => {
    const { patient } = await (await patientsRoute.POST(json("POST", { chartNo: "F-1" }))).json();
    const courseRes = await coursesRoute.POST(json("POST", { patientId: patient.id, procedure: "레이저토닝", scoreKind: "vas" }));
    expect(courseRes.status).toBe(201);
    const { course } = await courseRes.json();
    const bad = await visitsRoute.POST(json("POST", { courseId: course.id, date: "2026-10-21", kind: "session", sessionNo: 1, score: 11 }));
    expect(bad.status).toBe(400);
    const { visit } = await (await visitsRoute.POST(json("POST", { courseId: course.id, date: "2026-10-21", kind: "baseline", score: 3 }))).json();

    const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#aa8877" } }).jpeg().toBuffer();
    const form = new FormData();
    form.append("files", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "a.jpg");
    form.append("files", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "b.jpg");
    form.append("files", new Blob(["%PDF"], { type: "application/pdf" }), "c.pdf");
    const upload = await uploadRoute.POST(new Request("http://test.local/api", { method: "POST", body: form }), params(visit.id));
    const uploaded = await upload.json();
    expect(uploaded.photos.map((p: { angle: string }) => p.angle)).toEqual(["front", "left45"]);
    expect(uploaded.errors).toEqual([{ name: "c.pdf", message: expect.stringContaining("사진 파일") }]);

    const photoId = uploaded.photos[0].id;
    const thumb = await photoRoute.GET(new Request("http://test.local/api?size=thumb"), params(photoId));
    expect(thumb.headers.get("Content-Type")).toBe("image/jpeg");
    expect(thumb.headers.get("Cache-Control")).toContain("private");
    const angled = await photoRoute.PATCH(json("PATCH", { angle: "close" }), params(photoId));
    expect((await angled.json()).photo.angle).toBe("close");

    const dir = process.env.CODEX_PHOTOS_DIR!;
    expect(fs.readdirSync(dir).length).toBe(4);
    expect((await visitRoute.DELETE(new Request("http://test.local/api", { method: "DELETE" }), params(visit.id))).status).toBe(200);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".jpg"))).toEqual([]);
  });
});

describe("consult → record", () => {
  it("registers a chart number, records the consult at once, and drops it on unlink", async () => {
    const bbip = await import("../lib/services/bbipService");
    const session = bbip.createSession({
      chips: { patient: ["40대 여성"], conditions: ["기미"], meds: [], procedures: ["피코토닝"] },
      flags: [],
      sourceNoteIds: [],
    });
    expect((await recordRoute.GET(new Request("http://test.local/api"), params(session.id))).status).toBe(404);

    const linked = await (await sessionPatientRoute.PUT(json("PUT", { chartNo: "N-501" }), params(session.id))).json();
    expect(linked.patient.patient.features).toBe("40대 여성 · 기미");
    // Linking records the consult at once: a baseline in a new 피코토닝 course.
    expect(linked.visit).toMatchObject({ kind: "baseline", sessionId: session.id });

    const defaults = await (await recordRoute.GET(new Request("http://test.local/api"), params(session.id))).json();
    expect(defaults.suggestedCourseId).toBe(linked.visit.courseId);
    const again = await recordRoute.POST(
      json("POST", { courseId: linked.visit.courseId, newCourse: null, visit: defaults.courses[0].defaults }),
      params(session.id)
    );
    expect(again.status).toBe(409);

    expect((await sessionPatientRoute.DELETE(new Request("http://test.local/api", { method: "DELETE" }), params(session.id))).status).toBe(200);
    expect(bbip.getSession(session.id)?.patientId).toBeUndefined();
    // Unlinking drops the visit (and the course it alone was in).
    const records = await import("../lib/services/recordsService");
    expect(records.getVisit(linked.visit.id)).toBeNull();
    expect(records.getCourse(linked.visit.courseId)).toBeNull();
  });
});
