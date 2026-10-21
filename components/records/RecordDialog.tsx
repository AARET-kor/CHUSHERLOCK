// components/records/RecordDialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { VisitDefaults } from "../../lib/records/defaults";
import { SCORE_KINDS, type ScoreKind, type Visit } from "../../lib/records/types";
import { emptyVisitDraft, VisitForm } from "./VisitForm";

interface Defaults {
  courses: Array<{ id: string; procedure: string; indication: string; scoreKind: ScoreKind; defaults: VisitDefaults }>;
  suggestedCourseId: string | null;
  newCourse: { procedure: string; indication: string; defaults: VisitDefaults };
}

/** "기록에 남기기" / "기록 수정". A linked consult already has its visit
 * (made automatically), so this edits it; without one, pick the course
 * (suggested) or start one and save a new visit. Native modal dialog like
 * PromoteDialog. */
export function RecordDialog({
  sessionId,
  visit,
  onClose,
  onSaved,
}: {
  sessionId: string;
  visit: Visit | null;
  onClose: () => void;
  onSaved: (visit: Visit) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Defaults | null>(null);
  const [courseId, setCourseId] = useState<string>("new");
  const [newCourse, setNewCourse] = useState({ procedure: "", indication: "", plannedSessions: "", scoreKind: "none" as ScoreKind });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    fetch(`/api/bbip/sessions/${sessionId}/record`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const d = (await res.json()) as Defaults;
        setData(d);
        setCourseId(d.suggestedCourseId ?? "new");
        setNewCourse((c) => ({ ...c, procedure: d.newCourse.procedure, indication: d.newCourse.indication }));
      })
      .catch(() => setError("기본값을 불러오지 못했습니다."));
  }, [sessionId]);

  const chosen = data?.courses.find((c) => c.id === (visit?.courseId ?? courseId)) ?? null;
  const defaults = chosen?.defaults ?? data?.newCourse.defaults;
  const scoreKind = chosen?.scoreKind ?? newCourse.scoreKind;

  function close() {
    if (dialog.current?.open) dialog.current.close();
    else onClose();
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="record-title" className="w-[min(720px,calc(100vw-32px))] rounded-[8px] p-6 backdrop:bg-ink/30">
      <h2 id="record-title" className="font-serifa text-[22px] font-bold text-inkdeep">
        {visit ? "Edit record · 기록 수정" : "Record · 기록에 남기기"}
      </h2>
      {visit && chosen && (
        <p className="mt-1 text-[14.5px] text-ink/70">
          {chosen.procedure}
          {chosen.indication ? ` · ${chosen.indication}` : ""}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-[14px] text-red-800">{error}</p>}
      {data && defaults && (
        <div className="mt-4 space-y-5">
          {!visit && (
          <fieldset>
            <legend className="text-[13px] text-ink/70">Course · 코스</legend>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
              {data.courses.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5">
                  <input type="radio" name="course" checked={courseId === c.id} onChange={() => setCourseId(c.id)} />
                  {c.procedure}
                  {c.indication ? ` · ${c.indication}` : ""}
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                <input type="radio" name="course" checked={courseId === "new"} onChange={() => setCourseId("new")} />
                New course · 새 코스
              </label>
            </div>
          </fieldset>
          )}
          {!visit && courseId === "new" && (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block text-[13px] text-ink/70 sm:col-span-2">Procedure · 시술<input required value={newCourse.procedure} onChange={(e) => setNewCourse({ ...newCourse, procedure: e.target.value })} className="bbip-line mt-1 text-[15px]" /></label>
              <label className="block text-[13px] text-ink/70">Planned · 계획 회차<input type="number" min={1} max={200} value={newCourse.plannedSessions} onChange={(e) => setNewCourse({ ...newCourse, plannedSessions: e.target.value })} className="bbip-line mt-1 text-[15px]" /></label>
              <label className="block text-[13px] text-ink/70">Score · 점수
                <select value={newCourse.scoreKind} onChange={(e) => setNewCourse({ ...newCourse, scoreKind: e.target.value as ScoreKind })} className="mt-1 block w-full border-b border-ink/20 bg-transparent py-1 text-[15px]">
                  {(Object.keys(SCORE_KINDS) as ScoreKind[]).map((k) => <option key={k} value={k}>{SCORE_KINDS[k].en} · {SCORE_KINDS[k].ko}</option>)}
                </select>
              </label>
            </div>
          )}
          <VisitForm
            key={courseId}
            initial={visit ?? { ...emptyVisitDraft(defaults.date), ...defaults }}
            scoreKind={scoreKind}
            submitLabel="Save · 저장"
            onCancel={close}
            onSubmit={async (draft) => {
              if (visit) {
                const res = await fetch(`/api/records/visits/${visit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(draft),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) return body.error ?? "저장하지 못했습니다.";
                onSaved(body.visit);
                close();
                return null;
              }
              const res = await fetch(`/api/bbip/sessions/${sessionId}/record`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  courseId: courseId === "new" ? null : courseId,
                  newCourse:
                    courseId === "new"
                      ? {
                          procedure: newCourse.procedure,
                          indication: newCourse.indication,
                          plannedSessions: newCourse.plannedSessions ? Number(newCourse.plannedSessions) : null,
                          scoreKind: newCourse.scoreKind,
                        }
                      : null,
                  visit: draft,
                }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) return body.error ?? "기록하지 못했습니다.";
              onSaved(body.visit);
              close();
              return null;
            }}
          />
        </div>
      )}
    </dialog>
  );
}
