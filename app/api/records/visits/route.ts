// app/api/records/visits/route.ts
import { badRequest, recordsError } from "../../../../lib/records/http";
import { visitCreateSchema } from "../../../../lib/records/schemas";
import { createVisit } from "../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";

/** POST { courseId, date, kind, … } → 201 { visit } */
export async function POST(request: Request) {
  const parsed = visitCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    return Response.json({ visit: createVisit({ ...parsed.data, sessionId: null }) }, { status: 201 });
  } catch (error) {
    return recordsError(error);
  }
}
