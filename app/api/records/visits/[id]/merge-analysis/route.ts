// app/api/records/visits/[id]/merge-analysis/route.ts
import { notFound } from "../../../../../../lib/records/http";
import { getVisit, updateVisit } from "../../../../../../lib/services/recordsService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const NOTE_MAX = 4000;

/** POST → { visit }: appends the AI change analysis to the visit note,
 * marked as a draft. The analysis itself stays on the visit. */
export async function POST(_request: Request, { params }: Ctx) {
  const visit = getVisit((await params).id);
  if (!visit) return notFound("방문");
  if (!visit.aiAnalysis) return Response.json({ error: "합칠 AI 분석이 없습니다." }, { status: 400 });
  const note = [visit.note.trim(), `[AI 변화 분석 초안] ${visit.aiAnalysis.text}`].filter(Boolean).join("\n\n").slice(0, NOTE_MAX);
  return Response.json({ visit: updateVisit(visit.id, { note }) });
}
