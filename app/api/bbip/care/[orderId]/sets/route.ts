// app/api/bbip/care/[orderId]/sets/route.ts
import { caseText } from "../../../../../../lib/bbip/care/interactions";
import { orderReady } from "../../../../../../lib/bbip/care/lint";
import { saveCareSetSchema } from "../../../../../../lib/bbip/care/schemas";
import { toSetItems } from "../../../../../../lib/bbip/care/sets";
import { getSession } from "../../../../../../lib/services/bbipService";
import { getCareOrderById, saveCareSet } from "../../../../../../lib/services/careService";

export const dynamic = "force-dynamic";

/** POST { procedure } → { set }: the confirmed rows become that procedure's set. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const parsed = saveCareSetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "시술을 골라 주세요." }, { status: 400 });
  const order = getCareOrderById(orderId);
  const session = order ? getSession(order.sessionId) : null;
  if (!order || !session) return Response.json({ error: "오더를 찾을 수 없습니다." }, { status: 404 });
  if (!session.chips.procedures.includes(parsed.data.procedure)) {
    return Response.json({ error: "이 케이스의 시술이 아닙니다." }, { status: 400 });
  }
  if (!orderReady(order.items, caseText(session.chips, session.flags))) {
    return Response.json({ error: "모든 행을 확인한 뒤 저장할 수 있습니다." }, { status: 409 });
  }
  const set = saveCareSet({ label: parsed.data.procedure, items: toSetItems(order.items), sourceSessionId: session.id });
  return Response.json({ set });
}
