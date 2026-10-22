import { db } from "../../../../../../lib/db/client";
import { analysisIsCurrent } from "../../../../../../lib/records/analysis";
import { VISIT_NOTE_MAX } from "../../../../../../lib/records/types";
import { notFound } from "../../../../../../lib/records/http";
import { getCourse, getPatientRecord, getVisit, updateVisit } from "../../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const id = (await params).id;
  const body = await request.json().catch(() => null);
  return db.transaction(() => {
    const visit = getVisit(id);
    if (!visit) return notFound("방문");
    const analysis = visit.aiAnalysis;
    if (!analysis) return Response.json({ error: "합칠 AI 분석이 없습니다." }, { status: 400 });
    if (body?.analysisId && body.analysisId !== analysis.id) return Response.json({ error: "분석이 변경되었습니다. 새로 확인해 주세요." }, { status: 409 });
    const courseInfo = getCourse(visit.courseId)!;
    const course = getPatientRecord(courseInfo.patientId)!.courses.find(c => c.id === visit.courseId)!;
    if (!analysisIsCurrent(course, id, analysis)) return Response.json({ error: "사진 또는 시술 정보가 변경되었습니다. 다시 분석해 주세요." }, { status: 409 });
    if (analysis.mergedAt) return Response.json({ visit });
    const note = [visit.note.trim(), `[AI 변화 분석 초안] ${analysis.text}`].filter(Boolean).join("\n\n");
    if (note.length > VISIT_NOTE_MAX) return Response.json({ error: `메모가 ${VISIT_NOTE_MAX}자를 초과합니다. 기존 메모를 정리한 뒤 합쳐 주세요.` }, { status: 400 });
    return Response.json({ visit: updateVisit(id, { note, aiAnalysis: { ...analysis, mergedAt: new Date().toISOString() } }) });
  });
}
