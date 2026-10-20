// app/api/bbip/care/[orderId]/route.ts
import { caseText } from "../../../../../lib/bbip/care/interactions";
import { canConfirm } from "../../../../../lib/bbip/care/lint";
import { patchCareSchema } from "../../../../../lib/bbip/care/schemas";
import { getSession } from "../../../../../lib/services/bbipService";
import { getCareOrderById, updateCareItems } from "../../../../../lib/services/careService";

export const dynamic = "force-dynamic";

/** PATCH { items } → { order }. Confirmation is re-checked here: a row with
 * an error, or a removed row, is never stored as confirmed. */
export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const parsed = patchCareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." }, { status: 400 });
  }
  const order = getCareOrderById(orderId);
  if (!order) return Response.json({ error: "오더를 찾을 수 없습니다." }, { status: 404 });
  const session = getSession(order.sessionId);
  const context = session ? caseText(session.chips, session.flags) : "";
  const items = parsed.data.items.map((item) => ({
    ...item,
    confirmed: item.confirmed && !item.removed && canConfirm(item, context),
  }));
  return Response.json({ order: updateCareItems(orderId, items) });
}
