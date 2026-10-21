// app/api/records/visits/[id]/route.ts
import { badRequest, notFound, recordsError } from "../../../../../lib/records/http";
import { visitPatchSchema } from "../../../../../lib/records/schemas";
import { deleteVisit, updateVisit } from "../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const parsed = visitPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const visit = updateVisit((await params).id, parsed.data);
    return visit ? Response.json({ visit }) : notFound("방문");
  } catch (error) {
    return recordsError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return deleteVisit((await params).id) ? Response.json({ ok: true }) : notFound("방문");
}
