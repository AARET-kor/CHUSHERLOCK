// app/api/bbip/sessions/[id]/care/route.ts
import { createCareOrder } from "../../../../../../lib/bbip/care/createCareOrder";
import { CareGenerationError, CareNotFoundError } from "../../../../../../lib/bbip/care/errors";
import { aiErrorMessage } from "../../../../../../lib/bbip/runTurn";
import { getSession } from "../../../../../../lib/services/bbipService";
import { getCareOrder } from "../../../../../../lib/services/careService";

export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __bbipCareInFlight: Set<string> | undefined;
}

function inFlight(): Set<string> {
  return (globalThis.__bbipCareInFlight ??= new Set<string>());
}

/** POST { replace?: boolean } → { order }. Without `replace` an existing
 * order is returned unchanged (double clicks, reloads). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { replace?: unknown } | null;
  if (!getSession(id)) return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  const existing = getCareOrder(id);
  if (existing && body?.replace !== true) return Response.json({ order: existing });
  if (inFlight().has(id)) return Response.json({ error: "오더를 작성하는 중입니다." }, { status: 409 });
  inFlight().add(id);
  try {
    return Response.json({ order: await createCareOrder(id) });
  } catch (error) {
    if (error instanceof CareNotFoundError) return Response.json({ error: error.message }, { status: 404 });
    console.error("[bbip] care order failed:", error);
    const message =
      error instanceof CareGenerationError ? error.message : (aiErrorMessage(error) ?? "오더 작성에 실패했습니다.");
    return Response.json({ error: message }, { status: 502 });
  } finally {
    inFlight().delete(id);
  }
}
