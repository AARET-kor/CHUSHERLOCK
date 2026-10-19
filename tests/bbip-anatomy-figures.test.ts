// tests/bbip-anatomy-figures.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anatomyFigureScore, pickAnatomyFigures } from "../lib/bbip/anatomy/figures";
import { setupTempDb } from "./helpers/tempDb";

describe("anatomyFigureScore", () => {
  it("scores anatomy captions and ranks region matches first", () => {
    const general = anatomyFigureScore("Facial artery course and depth", ["tear-trough"]);
    const regional = anatomyFigureScore("눈물고랑 angular artery 주행", ["tear-trough"]);
    expect(general).toBeGreaterThan(0);
    expect(regional).toBeGreaterThan(general);
  });

  it("ignores captions without anatomy or region words", () => {
    expect(anatomyFigureScore("문서 내장 이미지 (a.png)", ["nasolabial"])).toBe(0);
    expect(anatomyFigureScore("시술 전후 만족도 설문", ["nasolabial"])).toBe(0);
  });

  it("picks the best figures in score order", () => {
    const rows = [
      { id: "a", caption: "만족도 그래프", kind: "chart", entryId: "e", entryTitle: "t" },
      { id: "b", caption: "Temple layers and vessels", kind: "figure", entryId: "e", entryTitle: "t" },
      { id: "c", caption: "팔자 facial artery 주행", kind: "figure", entryId: "e", entryTitle: "t" },
    ];
    expect(pickAnatomyFigures(rows, ["nasolabial"]).map((f) => f.id)).toEqual(["c", "b"]);
  });
});

describe("GET /api/bbip/sessions/:id/figures", () => {
  let env: Awaited<ReturnType<typeof setupTempDb>>;
  let sessionsRoute: typeof import("../app/api/bbip/sessions/route");
  let figuresRoute: typeof import("../app/api/bbip/sessions/[id]/figures/route");

  beforeAll(async () => {
    env = await setupTempDb("bbip-figures");
    const [entryService, schemas, { db }, { figures }] = await Promise.all([
      import("../lib/services/entryService"),
      import("../lib/schemas/entrySchemas"),
      import("../lib/db/client"),
      import("../lib/db/schema"),
    ]);
    const { entry } = await entryService.createEntry(
      schemas.createEntrySchema.parse({
        title: "팔자 필러 해부",
        content: "팔자 필러 시 안면동맥 주행을 확인한다.",
        categoryKey: "face-filler",
        tier: "procedure_tip",
        tags: ["팔자", "필러"],
        sources: [{ type: "book", citation: "해부 교과서" }],
        status: "reviewed",
      })
    );
    const now = new Date().toISOString();
    db.insert(figures)
      .values([
        { id: "fig-anat", entryId: entry.id, filename: "a.png", kind: "figure", caption: "Facial artery along the nasolabial fold", page: 3, createdAt: now },
        { id: "fig-other", entryId: entry.id, filename: "b.png", kind: "photo", caption: "문서 내장 이미지 (b.png)", page: null, createdAt: now },
      ])
      .run();
    sessionsRoute = await import("../app/api/bbip/sessions/route");
    figuresRoute = await import("../app/api/bbip/sessions/[id]/figures/route");
  });
  afterAll(() => env.cleanup());

  it("returns anatomy figures attached to the session's notes", async () => {
    const res = await sessionsRoute.POST(
      new Request("http://test.local/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "50대 여성, 팔자주름, 팔자 필러 희망" }),
      })
    );
    const { session } = await res.json();
    const out = await figuresRoute.GET(new Request("http://test.local"), {
      params: Promise.resolve({ id: session.id as string }),
    });
    expect(out.status).toBe(200);
    const data = await out.json();
    expect(data.figures).toEqual([
      expect.objectContaining({ id: "fig-anat", entryTitle: "팔자 필러 해부", kind: "figure" }),
    ]);
  });

  it("404s for an unknown session", async () => {
    const out = await figuresRoute.GET(new Request("http://test.local"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(out.status).toBe(404);
  });
});
