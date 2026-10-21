// components/records/PatientHistoryPanel.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SCORE_KINDS, VISIT_KIND_LABEL, type PatientRecord, type Photo, type Visit } from "../../lib/records/types";
import { T } from "../../lib/bbip/terms";
import { Term } from "../bbip/Term";
import { PhotoDropZone } from "./PhotoDropZone";
import { PhotoStrip } from "./PhotoStrip";

/** The linked patient's course at a glance, and — once this consult is
 * recorded — a drop zone that attaches photos to its visit. */
export function PatientHistoryPanel({
  patientId,
  visit,
  version,
  onRecord,
}: {
  patientId: string;
  visit: Visit | null;
  /** Bump to refetch (after recording). */
  version: number;
  onRecord: () => void;
}) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    fetch(`/api/records/patients/${patientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PatientRecord | null) => {
        setRecord(data);
        const own = data?.courses.flatMap((c) => c.visits).find((v) => v.id === visit?.id);
        setPhotos(own?.photos ?? []);
      })
      .catch(() => setRecord(null));
  }, [patientId, visit?.id, version]);

  if (!record) return null;
  const active = record.courses.filter((c) => c.status === "active");

  return (
    <div className="mt-6 rounded-[6px] bg-mist/60 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[14.5px] font-semibold text-ink/75"><Term term={T.patientHistory} /></h3>
        {!visit && (
          <button type="button" onClick={onRecord} className="rounded-full bg-inkdeep px-4 py-1.5 text-[14px] font-semibold text-white">
            {T.recordVisit.en} · {T.recordVisit.ko}
          </button>
        )}
      </div>
      {active.length === 0 ? (
        <p className="mt-2 text-[14.5px] text-ink/65">진행 중인 코스가 없습니다. 기록에 남기면 새 코스로 시작합니다.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {active.map((c) => {
            const last = c.visits.at(-1);
            const scores = c.visits.filter((v) => v.score !== null).map((v) => v.score);
            const thumbs = c.visits.flatMap((v) => v.photos).slice(-3);
            return (
              <li key={c.id} className="text-[15px]">
                <Link href={`/patients/${patientId}/courses/${c.id}`} className="font-semibold text-inkdeep underline decoration-ink/25 underline-offset-4">
                  {c.procedure}
                </Link>{" "}
                <span className="text-ink/70">
                  {c.visits.filter((v) => v.kind === "session").length}
                  {c.plannedSessions ? `/${c.plannedSessions}` : "회"}
                  {last ? ` · Last ${last.date.slice(5)} ${last.kind === "session" && last.sessionNo ? `S${last.sessionNo}` : VISIT_KIND_LABEL[last.kind].en}` : ""}
                  {last?.params ? ` · ${last.params}` : ""}
                  {scores.length ? ` · ${SCORE_KINDS[c.scoreKind].en} ${scores.join(" → ")}` : ""}
                  {last?.nextFuDate ? ` · F/U ${last.nextFuDate.slice(5)}` : ""}
                </span>
                {thumbs.length > 0 && (
                  <span className="mt-1 flex gap-2">
                    {thumbs.map((p) => (
                      <img key={p.id} src={`/api/records/photos/${p.id}?size=thumb`} alt="이전 사진" className="h-14 w-14 rounded-[3px] object-cover" />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {visit && (
        <PhotoDropZone visitId={visit.id} onUploaded={(added) => setPhotos((p) => [...p, ...added])} className="mt-4 border-t border-ink/10 pt-3">
          <p className="text-[14px] text-ink/75">
            이 진료는 {visit.date} {visit.kind === "session" && visit.sessionNo ? `${visit.sessionNo}회차` : VISIT_KIND_LABEL[visit.kind].ko} 방문으로 기록됐습니다.
          </p>
          <PhotoStrip
            photos={photos}
            onChange={(photo) => setPhotos((p) => p.map((x) => (x.id === photo.id ? photo : x)))}
            onRemove={(id) => setPhotos((p) => p.filter((x) => x.id !== id))}
          />
        </PhotoDropZone>
      )}
    </div>
  );
}
