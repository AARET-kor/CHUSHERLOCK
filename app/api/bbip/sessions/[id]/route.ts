// app/api/bbip/sessions/[id]/route.ts
import { loadSessionView } from "../../../../../lib/bbip/openSession";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadSessionView(id);
  if (!view) return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  return Response.json(view);
}
