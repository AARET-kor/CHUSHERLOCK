// app/api/records/courses/[id]/route.ts
import { badRequest, notFound } from "../../../../../lib/records/http";
import { coursePatchSchema } from "../../../../../lib/records/schemas";
import { deleteCourse, updateCourse } from "../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const parsed = coursePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const course = updateCourse((await params).id, parsed.data);
  return course ? Response.json({ course }) : notFound("코스");
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return deleteCourse((await params).id) ? Response.json({ ok: true }) : notFound("코스");
}
