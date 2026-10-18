// tests/bbip-api.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StreamEvent } from "../lib/bbip/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let sessionsRoute: typeof import("../app/api/bbip/sessions/route");
let sessionRoute: typeof import("../app/api/bbip/sessions/[id]/route");
let turnsRoute: typeof import("../app/api/bbip/sessions/[id]/turns/route");
let readNdjson: typeof import("../lib/bbip/readNdjson").readNdjson;

beforeAll(async () => {
  env = await setupTempDb("bbip-api");
  const [entryService, schemas] = await Promise.all([
    import("../lib/services/entryService"),
    import("../lib/schemas/entrySchemas"),
  ]);
  await entryService.createEntry(
    schemas.createEntrySchema.parse({
      title: "피코토닝 기미 프로토콜",
      content: "기미 피코토닝은 저출력으로 반복 조사한다. 기미 재발 설명 포함.",
      categoryKey: "pico-toning",
      tier: "procedure_tip",
      tags: ["피코토닝", "기미"],
      sources: [{ type: "book", citation: "API 테스트 교과서" }],
      status: "reviewed",
    })
  );
  sessionsRoute = await import("../app/api/bbip/sessions/route");
  sessionRoute = await import("../app/api/bbip/sessions/[id]/route");
  turnsRoute = await import("../app/api/bbip/sessions/[id]/turns/route");
  readNdjson = (await import("../lib/bbip/readNdjson")).readNdjson;
});
afterAll(() => env.cleanup());

function post(body: unknown): Request {
  return new Request("http://test.local/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("BBIP API", () => {
  it("opens a session, streams a brief, and serves the session view", async () => {
    const res = await sessionsRoute.POST(post({ input: "40대 여성, 기미, 아스피린 복용, 피코토닝 희망" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session.chips.procedures).toEqual(["피코토닝"]);
    expect(data.session.flags[0].text).toContain("항응고");
    expect(data.notes[0]).toMatchObject({ n: 1, title: "피코토닝 기미 프로토콜" });

    const params = Promise.resolve({ id: data.session.id as string });
    const stream = await turnsRoute.POST(post({ kind: "brief" }), { params });
    expect(stream.headers.get("Content-Type")).toContain("application/x-ndjson");
    const events: StreamEvent[] = [];
    for await (const event of readNdjson(stream.body!)) events.push(event);
    expect(events.at(-1)?.type).toBe("done");

    const view = await (await sessionRoute.GET(new Request("http://test.local"), { params })).json();
    expect(view.turns).toHaveLength(1);
    expect(view.turns[0].status).toBe("done");
    expect(view.notes).toHaveLength(1);

    const list = await (await sessionsRoute.GET()).json();
    expect(list.sessions[0].id).toBe(data.session.id);
  });

  it("opens a session from edited chips with rule flags only", async () => {
    const res = await sessionsRoute.POST(
      post({ chips: { patient: [], conditions: [], meds: ["와파린"], procedures: ["필러"] } })
    );
    const data = await res.json();
    expect(data.session.flags.map((f: { source: string }) => f.source)).toEqual(["rule"]);
  });

  it("rejects bad input and unknown sessions", async () => {
    expect((await sessionsRoute.POST(post({ input: "" }))).status).toBe(400);
    expect(
      (await turnsRoute.POST(post({ kind: "section", sectionKey: "nope" }), {
        params: Promise.resolve({ id: "x" }),
      })).status
    ).toBe(400);
    const phoneOnly = await turnsRoute.POST(post({ kind: "custom", question: "010-1234-5678" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(phoneOnly.status).toBe(400);
    expect((await phoneOnly.json()).error).toBe("질문을 확인해 주세요.");
    expect(
      (await turnsRoute.POST(post({ kind: "brief" }), { params: Promise.resolve({ id: "missing" }) }))
        .status
    ).toBe(404);
    expect(
      (await sessionRoute.GET(new Request("http://test.local"), {
        params: Promise.resolve({ id: "missing" }),
      })).status
    ).toBe(404);
  });
});
