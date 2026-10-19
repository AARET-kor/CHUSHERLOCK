// app/api/bbip/sessions/[id]/figures/route.ts
import { listSessionAnatomyFigures } from "../../../../../../lib/bbip/anatomy/figureQuery";
import { getSession } from "../../../../../../lib/services/bbipService";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ figures: listSessionAnatomyFigures(session) });
}
