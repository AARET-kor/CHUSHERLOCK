// app/api/records/compare/route.ts
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isFakeMode } from "../../../../lib/ai/client";
import {
  buildCompareParams,
  callCompareModel,
  CompareError,
  fakeCompareText,
  imageForAi,
} from "../../../../lib/records/compareAi";
import { compareFacts } from "../../../../lib/records/compareFacts";
import { photoPath } from "../../../../lib/records/files";
import { badRequest, notFound } from "../../../../lib/records/http";
import { ANGLES, type Angle } from "../../../../lib/records/types";
import { getCourse, getPatientRecord, getVisit, updateVisit } from "../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";

const compareSchema = z.object({
  fromVisitId: z.string().min(1).max(100),
  toVisitId: z.string().min(1).max(100),
  fromPhotoId: z.string().optional(),
  toPhotoId: z.string().optional(),
  angle: z.enum(ANGLES as [Angle, ...Angle[]]),
});

/** POST { fromVisitId, toVisitId, angle } → { visit }. Sends the two photos
 * of that angle and the course's clinical facts (lib/records/compareFacts)
 * to Claude; the draft is stored on the "to" visit as aiAnalysis. */
export async function POST(request: Request) {
  const parsed = compareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { fromVisitId, toVisitId, angle, fromPhotoId, toPhotoId } = parsed.data;
  const from = getVisit(fromVisitId);
  const to = getVisit(toVisitId);
  if (!from || !to || from.id === to.id) return notFound("방문");
  if (from.courseId !== to.courseId) {
    return Response.json({ error: "같은 코스의 방문끼리만 비교할 수 있습니다." }, { status: 400 });
  }
  const course = getPatientRecord(getCourse(from.courseId)!.patientId)!.courses.find((c) => c.id === from.courseId)!;
  const photoOf = (visitId: string, photoId?: string) =>
    course.visits.find((v) => v.id === visitId)?.photos.find((p) => p.angle === angle && (!photoId || p.id === photoId));
  const before = photoOf(from.id, fromPhotoId);
  const after = photoOf(to.id, toPhotoId);
  if (!before || !after) {
    return Response.json({ error: "두 방문 모두 이 각도의 사진이 있어야 합니다." }, { status: 400 });
  }

  const facts = compareFacts(course, from.id, to.id, angle);
  let result: { text: string; model: string };
  if (isFakeMode()) {
    result = { text: fakeCompareText(), model: "fake" };
  } else {
    try {
      const [b, a] = await Promise.all([
        imageForAi(fs.readFileSync(photoPath(before.file))),
        imageForAi(fs.readFileSync(photoPath(after.file))),
      ]);
      result = await callCompareModel(
        buildCompareParams({ facts, before: b, after: a })
      );
    } catch (error) {
      const message = error instanceof CompareError ? error.message : "AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      if (!(error instanceof CompareError)) console.error("[records] compare failed:", error);
      return Response.json({ error: message }, { status: 502 });
    }
  }
  const latest = getVisit(to.id);
  if (!latest) return notFound("방문");
  const previous = latest.aiAnalysis;
  const history = previous ? [{ ...previous, history: undefined }, ...(previous.history ?? [])] : [];
  const visit = updateVisit(to.id, {
    aiAnalysis: { id: randomUUID(), fromPhotoId: before.id, toPhotoId: after.id, facts, history, text: result.text, model: result.model, fromVisitId: from.id, angle, createdAt: new Date().toISOString() },
  });
  return Response.json({ visit });
}
