// components/records/CoursePage.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { nextSessionNo } from "../../lib/records/schedule";
import {
  ANGLE_LABEL,
  ANGLES,
  SCORE_KINDS,
  STATUS_LABEL,
  VISIT_KIND_LABEL,
  type CourseRecord,
  type CourseStatus,
  type Patient,
  type Photo,
  type VisitWithPhotos,
} from "../../lib/records/types";
import { T } from "../../lib/bbip/terms";
import { Term } from "../bbip/Term";
import { PhotoDropZone } from "./PhotoDropZone";
import { PhotoStrip } from "./PhotoStrip";
import { emptyVisitDraft, VisitForm, type VisitDraft } from "./VisitForm";

const LINK = "underline decoration-ink/25 underline-offset-4 hover:decoration-ink";

function visitLabel(v: VisitWithPhotos): string {
  return v.kind === "session" && v.sessionNo ? `S${v.sessionNo}` : VISIT_KIND_LABEL[v.kind].en;
}

/** Course header, photo grid (angle × visit), visits with drop zones and an
 * add-visit form prefilled to continue the course. */
export function CoursePage({ patient, initial, today }: { patient: Patient; initial: CourseRecord; today: string }) {
  const [course, setCourse] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const done = course.visits.filter((v) => v.kind === "session").length;
  const nextFu = course.visits.at(-1)?.nextFuDate ?? null;
  const usedAngles = ANGLES.filter((a) => course.visits.some((v) => v.photos.some((p) => p.angle === a)));

  const updateVisit = (id: string, fn: (v: VisitWithPhotos) => VisitWithPhotos) =>
    setCourse((c) => ({ ...c, visits: c.visits.map((v) => (v.id === id ? fn(v) : v)) }));
  const addPhotos = (visitId: string, photos: Photo[]) => updateVisit(visitId, (v) => ({ ...v, photos: [...v.photos, ...photos] }));

  async function saveVisit(draft: VisitDraft, id?: string): Promise<string | null> {
    const res = await fetch(id ? `/api/records/visits/${id}` : "/api/records/visits", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? draft : { ...draft, courseId: course.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "저장하지 못했습니다.";
    if (id) updateVisit(id, (v) => ({ ...v, ...data.visit }));
    else setCourse((c) => ({ ...c, visits: [...c.visits, { ...data.visit, photos: [] }].sort((a, b) => a.date.localeCompare(b.date)) }));
    setAdding(false);
    setEditingId(null);
    return null;
  }

  async function removeVisit(v: VisitWithPhotos) {
    if (!window.confirm(`${v.date} 방문과 사진 ${v.photos.length}장을 지울까요?`)) return;
    const res = await fetch(`/api/records/visits/${v.id}`, { method: "DELETE" });
    if (res.ok) setCourse((c) => ({ ...c, visits: c.visits.filter((x) => x.id !== v.id) }));
  }

  async function setStatus(status: CourseStatus) {
    const res = await fetch(`/api/records/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setCourse((c) => ({ ...c, status }));
  }

  const last = [...course.visits].reverse().find((v) => v.product || v.params);
  const addDraft: VisitDraft = {
    ...emptyVisitDraft(today),
    kind: course.visits.length ? "session" : "baseline",
    sessionNo: course.visits.length ? nextSessionNo(course.visits) : null,
    product: last?.product ?? "",
    params: last?.params ?? "",
  };
  const latest = course.visits.at(-1);

  return (
    <div>
      <header className="pb-8 pt-2 md:pt-6">
        <Link href={`/patients/${patient.id}`} className="text-[14px] text-ink/60 hover:text-ink">
          ← #{patient.chartNo} {patient.alias}
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[14px] text-ink/65">{patient.features}</p>
            <h1 className="font-serifa text-[2.4rem] font-bold leading-tight text-inkdeep">{course.procedure}</h1>
            <p className="text-[16px] text-ink/75">{[course.indication, `${SCORE_KINDS[course.scoreKind].en} · ${SCORE_KINDS[course.scoreKind].ko}`].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-ink/65">Sessions · 회차</p>
            <p className="font-serifa text-[2rem] font-bold text-inkdeep">{done}<span className="text-[1rem] text-ink/60">{course.plannedSessions ? ` / ${course.plannedSessions}` : ""}</span></p>
            {nextFu && <p className="text-[14px] text-[#0f5132]">Next F/U · {nextFu}</p>}
            <select aria-label="코스 상태" value={course.status} onChange={(e) => void setStatus(e.target.value as CourseStatus)} className="mt-1 border-b border-ink/20 bg-transparent text-[14px]">
              {(Object.keys(STATUS_LABEL) as CourseStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s].en} · {STATUS_LABEL[s].ko}</option>)}
            </select>
          </div>
        </div>
      </header>

      {latest && (
        <PhotoDropZone visitId={latest.id} onUploaded={(photos) => addPhotos(latest.id, photos)} className="border-t border-ink/10 pb-8 pt-6">
          <h2 className="mb-3 text-[14.5px] font-semibold text-ink/70"><Term term={T.photos} /></h2>
          {usedAngles.length === 0 ? (
            <p className="text-[14.5px] text-ink/60">아직 사진이 없습니다. 최근 방문({latest.date})에 사진을 끌어다 놓으세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-2 text-[12.5px] text-ink/65">
                <thead>
                  <tr>
                    <th />
                    {course.visits.map((v) => <th key={v.id} scope="col" className="text-left font-medium">{visitLabel(v)}<span className="block font-normal">{v.date.slice(5)}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {usedAngles.map((angle) => (
                    <tr key={angle}>
                      <th scope="row" className="pr-2 text-left font-medium">{ANGLE_LABEL[angle].en}<span className="block font-normal">{ANGLE_LABEL[angle].ko}</span></th>
                      {course.visits.map((v) => {
                        const photo = v.photos.find((p) => p.angle === angle);
                        return (
                          <td key={v.id}>
                            {photo ? (
                              <a href={`/api/records/photos/${photo.id}`} target="_blank" rel="noreferrer">
                                <img src={`/api/records/photos/${photo.id}?size=thumb`} alt={`${visitLabel(v)} ${ANGLE_LABEL[angle].ko}`} className="h-24 w-24 rounded-[4px] object-cover" />
                              </a>
                            ) : (
                              <div className="h-24 w-24 rounded-[4px] border border-dashed border-ink/20" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PhotoDropZone>
      )}

      <section aria-labelledby="course-visits" className="border-t border-ink/10 pt-6">
        <h2 id="course-visits" className="mb-3 text-[14.5px] font-semibold text-ink/70"><Term term={T.visits} /></h2>
        <ul>
          {[...course.visits].reverse().map((v) => (
            <li key={v.id} className="border-b border-ink/[0.07] py-4">
              {editingId === v.id ? (
                <VisitForm initial={v} scoreKind={course.scoreKind} submitLabel="Save · 저장" onSubmit={(d) => saveVisit(d, v.id)} onCancel={() => setEditingId(null)} />
              ) : (
                <PhotoDropZone visitId={v.id} onUploaded={(photos) => addPhotos(v.id, photos)}>
                  <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[15.5px]">
                    <span className="font-mono text-[13px] tabular-nums text-ink/60">{v.date}</span>
                    <span className="font-semibold text-inkdeep">{visitLabel(v)}</span>
                    <span className="text-ink/75">{[v.product, v.params].filter(Boolean).join(" · ")}</span>
                    <span className="text-ink/65">
                      {[v.gaisDoctor ? `GAIS ${v.gaisDoctor}` : "", v.score !== null ? `${SCORE_KINDS[course.scoreKind].en} ${v.score}` : "", v.nextFuDate ? `F/U ${v.nextFuDate.slice(5)}` : ""].filter(Boolean).join(" · ")}
                    </span>
                    <span className="ml-auto flex gap-4 text-[13.5px]">
                      <button type="button" onClick={() => setEditingId(v.id)} className={`text-ink/70 ${LINK}`}>Edit · 수정</button>
                      <button type="button" onClick={() => void removeVisit(v)} className={`text-ink/60 ${LINK} hover:text-red-800`}>Delete · 삭제</button>
                    </span>
                  </div>
                  {v.note && <p className="mt-1 text-[14.5px] text-ink/70">{v.note}</p>}
                  <PhotoStrip
                    photos={v.photos}
                    onChange={(photo) => updateVisit(v.id, (x) => ({ ...x, photos: x.photos.map((p) => (p.id === photo.id ? photo : p)) }))}
                    onRemove={(id) => updateVisit(v.id, (x) => ({ ...x, photos: x.photos.filter((p) => p.id !== id) }))}
                  />
                </PhotoDropZone>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-5">
          {adding ? (
            <VisitForm initial={addDraft} scoreKind={course.scoreKind} submitLabel={`${T.addVisit.en} · ${T.addVisit.ko}`} onSubmit={(d) => saveVisit(d)} onCancel={() => setAdding(false)} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={`text-[15px] font-semibold ${LINK}`}>+ {T.addVisit.en} · {T.addVisit.ko}</button>
          )}
        </div>
      </section>
    </div>
  );
}
