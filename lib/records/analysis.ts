import { compareFacts } from "./compareFacts";
import type { AiAnalysis, CourseRecord } from "./types";

/** Legacy results lack input identity and must be reanalysed before reuse. */
export function analysisIsCurrent(course: CourseRecord, toId: string, analysis: AiAnalysis): boolean {
  const from = course.visits.find(v => v.id === analysis.fromVisitId);
  const to = course.visits.find(v => v.id === toId);
  return Boolean(from?.photos.some(p => p.id === analysis.fromPhotoId && p.angle === analysis.angle)
    && to?.photos.some(p => p.id === analysis.toPhotoId && p.angle === analysis.angle)
    && analysis.facts === compareFacts(course, analysis.fromVisitId, toId, analysis.angle));
}
