// app/api/bbip/sessions/[id]/record/route.ts
import { suggestCourse, visitDefaults } from "../../../../../../lib/records/defaults";
import { badRequest, notFound, recordsError } from "../../../../../../lib/records/http";
import { nextFuFromCare, todayIso } from "../../../../../../lib/records/schedule";
import { recordCreateSchema } from "../../../../../../lib/records/schemas";
import { getSession } from "../../../../../../lib/services/bbipService";
import { getCareOrder } from "../../../../../../lib/services/careService";
import { createCourse, createVisit, getPatientRecord } from "../../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function load(id: string) {
  const session = getSession(id);
  if (!session?.patientId) return null;
  const record = getPatientRecord(session.patientId);
  return record ? { session, record } : null;
}

/** GET → defaults for "기록에 남기기": active courses, the suggested one and
 * the prefilled visit for it (or a baseline for a new course). */
export async function GET(_request: Request, { params }: Ctx) {
  const loaded = load((await params).id);
  if (!loaded) return notFound("연결된 환자");
  const { session, record } = loaded;
  const today = todayIso();
  const care = getCareOrder(session.id);
  const careNextFu = care ? nextFuFromCare(care.items, today) : null;
  const suggested = suggestCourse(record.courses, session.chips.procedures);
  const active = record.courses.filter((c) => c.status === "active");
  return Response.json({
    courses: active.map((c) => ({
      id: c.id,
      procedure: c.procedure,
      indication: c.indication,
      scoreKind: c.scoreKind,
      defaults: visitDefaults({ course: c, today, careNextFu }),
    })),
    suggestedCourseId: suggested?.id ?? null,
    newCourse: {
      procedure: session.chips.procedures[0] ?? "",
      indication: session.chips.conditions[0] ?? "",
      defaults: visitDefaults({ course: null, today, careNextFu }),
    },
  });
}

/** POST { courseId | newCourse, visit } → 201 { visit, courseId, patientId } */
export async function POST(request: Request, { params }: Ctx) {
  const loaded = load((await params).id);
  if (!loaded) return notFound("연결된 환자");
  const parsed = recordCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { session, record } = loaded;
  try {
    let courseId = parsed.data.courseId;
    if (!courseId) {
      if (!parsed.data.newCourse) return Response.json({ error: "코스를 고르거나 새로 만들어 주세요." }, { status: 400 });
      courseId = createCourse({
        ...parsed.data.newCourse,
        patientId: record.patient.id,
        startedAt: parsed.data.newCourse.startedAt ?? parsed.data.visit.date,
      }).id;
    } else if (!record.courses.some((c) => c.id === courseId)) {
      return notFound("코스");
    }
    const visit = createVisit({ ...parsed.data.visit, courseId, sessionId: session.id });
    return Response.json({ visit, courseId, patientId: record.patient.id }, { status: 201 });
  } catch (error) {
    return recordsError(error);
  }
}
