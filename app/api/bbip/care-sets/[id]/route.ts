// app/api/bbip/care-sets/[id]/route.ts
import { deleteCareSet } from "../../../../../lib/services/careService";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!deleteCareSet(id)) return Response.json({ error: "세트를 찾을 수 없습니다." }, { status: 404 });
  return new Response(null, { status: 204 });
}
