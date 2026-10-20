// tests/bbip-care-api.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CareItem, CareOrder } from "../lib/bbip/care/types";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;
let bbip: typeof import("../lib/services/bbipService");
let careRoute: typeof import("../app/api/bbip/sessions/[id]/care/route");
let orderRoute: typeof import("../app/api/bbip/care/[orderId]/route");
let setsRoute: typeof import("../app/api/bbip/care/[orderId]/sets/route");
let setListRoute: typeof import("../app/api/bbip/care-sets/route");
let setRoute: typeof import("../app/api/bbip/care-sets/[id]/route");
let sessionRoute: typeof import("../app/api/bbip/sessions/[id]/route");

beforeAll(async () => {
  env = await setupTempDb("bbip-care-api");
  bbip = await import("../lib/services/bbipService");
  careRoute = await import("../app/api/bbip/sessions/[id]/care/route");
  orderRoute = await import("../app/api/bbip/care/[orderId]/route");
  setsRoute = await import("../app/api/bbip/care/[orderId]/sets/route");
  setListRoute = await import("../app/api/bbip/care-sets/route");
  setRoute = await import("../app/api/bbip/care-sets/[id]/route");
  sessionRoute = await import("../app/api/bbip/sessions/[id]/route");
});
afterAll(() => env.cleanup());

function req(method: string, body?: unknown): Request {
  return new Request("http://test.local/api", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const p = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

function newSession() {
  return bbip.createSession({
    chips: { patient: [], conditions: ["기미"], meds: [], procedures: ["피코토닝", "리쥬란"] },
    flags: [],
    sourceNoteIds: [],
  });
}

async function draft(sessionId: string, body: unknown = {}): Promise<CareOrder> {
  const res = await careRoute.POST(req("POST", body), p({ id: sessionId }));
  expect(res.status).toBe(200);
  return (await res.json()).order;
}

describe("care API", () => {
  it("drafts once per session, returns it again, and replaces it on request", async () => {
    const session = newSession();
    const first = await draft(session.id);
    expect(first.items.map((item) => item.kind)).toEqual(["rx", "dressing", "contingency", "followup"]);
    expect((await draft(session.id)).id).toBe(first.id);
    expect((await draft(session.id, { replace: true })).id).not.toBe(first.id);
    expect((await careRoute.POST(req("POST", {}), p({ id: "missing" }))).status).toBe(404);
  });

  it("shows the order in the session view", async () => {
    const session = newSession();
    const order = await draft(session.id);
    const view = await (await sessionRoute.GET(new Request("http://test.local"), p({ id: session.id }))).json();
    expect(view.care.id).toBe(order.id);
  });

  it("validates PATCH bodies and never stores a confirmed row that has errors", async () => {
    const session = newSession();
    const order = await draft(session.id);
    expect((await orderRoute.PATCH(req("PATCH", { items: "x" }), p({ orderId: order.id }))).status).toBe(400);
    expect((await orderRoute.PATCH(req("PATCH", { items: [] }), p({ orderId: "missing" }))).status).toBe(404);
    const broken: CareItem = { ...order.items[0]!, fields: { ...order.items[0]!.fields, dose: "" }, confirmed: true };
    const res = await orderRoute.PATCH(req("PATCH", { items: [broken] }), p({ orderId: order.id }));
    const saved = (await res.json()).order as CareOrder;
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0]!.confirmed).toBe(false);
    expect(saved.items[0]!.fields).not.toHaveProperty("material");
  });

  it("saves a set only when every row is confirmed and the procedure belongs to the case", async () => {
    const session = newSession();
    const order = await draft(session.id);
    const notReady = await setsRoute.POST(req("POST", { procedure: "피코토닝" }), p({ orderId: order.id }));
    expect(notReady.status).toBe(409);
    const confirmed = order.items.map((item) => ({ ...item, confirmed: true }));
    await orderRoute.PATCH(req("PATCH", { items: confirmed }), p({ orderId: order.id }));
    expect((await setsRoute.POST(req("POST", { procedure: "울쎄라" }), p({ orderId: order.id }))).status).toBe(400);
    const saved = await setsRoute.POST(req("POST", { procedure: "리쥬란" }), p({ orderId: order.id }));
    expect(saved.status).toBe(200);
    const set = (await saved.json()).set;
    expect(set).toMatchObject({ label: "리쥬란", procedureKey: "리쥬란" });
    expect(set.items.every((item: CareItem) => item.source === "set" && !item.confirmed)).toBe(true);

    const listed = await (await setListRoute.GET()).json();
    expect(listed.sets.map((s: { id: string }) => s.id)).toContain(set.id);
    expect((await setRoute.DELETE(req("DELETE"), p({ id: set.id }))).status).toBe(204);
    expect((await setRoute.DELETE(req("DELETE"), p({ id: set.id }))).status).toBe(404);
  });
});
