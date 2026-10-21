// app/api/records/courses/route.ts
import { badRequest, recordsError } from "../../../../lib/records/http";
import { todayIso } from "../../../../lib/records/schedule";
import { courseCreateSchema } from "../../../../lib/records/schemas";
import { createCourse } from "../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";

/** POST { patientId, procedure, … } → 201 { course } */
export async function POST(request: Request) {
  const parsed = courseCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const course = createCourse({ ...parsed.data, startedAt: parsed.data.startedAt ?? todayIso() });
    return Response.json({ course }, { status: 201 });
  } catch (error) {
    return recordsError(error);
  }
}
