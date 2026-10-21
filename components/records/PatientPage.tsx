// components/records/PatientPage.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SCORE_KINDS, STATUS_LABEL, VISIT_KIND_LABEL, type PatientRecord, type ScoreKind } from "../../lib/records/types";
import { T } from "../../lib/bbip/terms";
import { Term } from "../bbip/Term";

const LINK = "underline decoration-ink/25 underline-offset-4 hover:decoration-ink";

/** Header (editable alias, features, memo), course cards and the timeline. */
export function PatientPage({ initial }: { initial: PatientRecord }) {
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.patient);
  const [course, setCourse] = useState({ procedure: "", indication: "", plannedSessions: "", scoreKind: "none" as ScoreKind });
  const [error, setError] = useState<string | null>(null);
  const p = record.patient;

  async function saveHeader() {
    const res = await fetch(`/api/records/patients/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chartNo: draft.chartNo, alias: draft.alias, features: draft.features, memo: draft.memo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "저장하지 못했습니다.");
    setRecord((r) => ({ ...r, patient: data.patient }));
    setEditing(false);
    setError(null);
  }

  async function addCourse() {
    const res = await fetch("/api/records/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: p.id,
        procedure: course.procedure,
        indication: course.indication,
        plannedSessions: course.plannedSessions ? Number(course.plannedSessions) : null,
        scoreKind: course.scoreKind,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "코스를 만들지 못했습니다.");
    router.push(`/patients/${p.id}/courses/${data.course.id}`);
  }

  async function removePatient() {
    if (!window.confirm(`#${p.chartNo} 환자의 모든 코스·방문·사진을 지울까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/records/patients/${p.id}`, { method: "DELETE" });
    if (res.ok) router.push("/cases");
  }

  const timeline = record.courses
    .flatMap((c) => c.visits.map((v) => ({ ...v, procedure: c.procedure })))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <header className="pb-10 pt-2 md:pt-6">
        <Link href="/cases" className="text-[14px] text-ink/60 hover:text-ink">
          ← {T.records.en} · {T.records.ko}
        </Link>
        {editing ? (
          <div className="mt-6 grid max-w-[720px] gap-4 sm:grid-cols-2">
            {(["chartNo", "alias", "features"] as const).map((key) => (
              <label key={key} className="block text-[13px] text-ink/70">
                {key === "chartNo" ? "Chart No · 차트번호" : key === "alias" ? "Alias · 별칭" : "Features · 특징"}
                <input value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="bbip-line mt-1 text-[16px] text-ink" />
              </label>
            ))}
            <label className="block text-[13px] text-ink/70 sm:col-span-2">
              Memo · 메모 (이름·연락처는 쓰지 마세요)
              <textarea rows={2} value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} className="mt-1 block w-full border border-ink/15 bg-transparent p-2 text-[15px] text-ink" />
            </label>
            <div className="flex gap-5 text-[15px]">
              <button type="button" onClick={() => void saveHeader()} className={`font-semibold ${LINK}`}>Save · 저장</button>
              <button type="button" onClick={() => { setDraft(p); setEditing(false); }} className={`text-ink/70 ${LINK}`}>Cancel · 취소</button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="font-mono text-[15px] text-ink/70">#{p.chartNo}</p>
            <h1 className="font-serifa text-[2.4rem] font-bold leading-tight text-inkdeep">{p.alias || "별칭 없음"}</h1>
            <p className="mt-1 text-[16px] text-ink/75">{p.features || "특징 없음"}</p>
            {p.memo && <p className="mt-2 max-w-[640px] text-[15px] text-ink/70">{p.memo}</p>}
            <div className="mt-3 flex gap-5 text-[14px]">
              <button type="button" onClick={() => setEditing(true)} className={`text-ink/70 ${LINK}`}>Edit · 수정</button>
              <button type="button" onClick={() => void removePatient()} className={`text-ink/60 ${LINK} hover:text-red-800`}>Delete · 삭제</button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-[14px] text-red-800">{error}</p>}
      </header>

      <section aria-labelledby="patient-courses" className="border-t border-ink/10 pb-10 pt-6">
        <h2 id="patient-courses" className="mb-4 text-[14.5px] font-semibold text-ink/70"><Term term={T.courses} /></h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {record.courses.map((c) => {
            const done = c.visits.filter((v) => v.kind === "session").length;
            const latest = [...c.visits].reverse().find((v) => v.photos.length)?.photos[0];
            return (
              <li key={c.id}>
                <Link href={`/patients/${p.id}/courses/${c.id}`} className="group block rounded-[6px] border border-ink/10 p-4 hover:border-ink/30">
                  <p className="text-[12.5px] text-ink/60">{STATUS_LABEL[c.status].en} · {STATUS_LABEL[c.status].ko}</p>
                  <p className="font-serifa text-[20px] font-bold text-inkdeep group-hover:underline">{c.procedure}</p>
                  <p className="text-[14px] text-ink/70">{[c.indication, SCORE_KINDS[c.scoreKind].en].filter(Boolean).join(" · ")}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full bg-[#0f5132]" style={{ width: `${c.plannedSessions ? Math.min(100, (done / c.plannedSessions) * 100) : 0}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[12.5px] text-ink/65">{done}{c.plannedSessions ? ` / ${c.plannedSessions}` : "회"} · {c.visits.length} visits</p>
                  {latest && (
                    <img src={`/api/records/photos/${latest.id}?size=thumb`} alt="최근 사진" className="mt-3 h-24 w-24 rounded-[4px] object-cover" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <form
          className="mt-6 grid max-w-[860px] gap-3 sm:grid-cols-[1fr_1fr_120px_160px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void addCourse();
          }}
        >
          <label className="block text-[13px] text-ink/70">Procedure · 시술<input required value={course.procedure} onChange={(e) => setCourse({ ...course, procedure: e.target.value })} className="bbip-line mt-1 text-[15px]" /></label>
          <label className="block text-[13px] text-ink/70">Indication · 적응증<input value={course.indication} onChange={(e) => setCourse({ ...course, indication: e.target.value })} className="bbip-line mt-1 text-[15px]" /></label>
          <label className="block text-[13px] text-ink/70">Planned · 계획 회차<input type="number" min={1} max={200} value={course.plannedSessions} onChange={(e) => setCourse({ ...course, plannedSessions: e.target.value })} className="bbip-line mt-1 text-[15px]" /></label>
          <label className="block text-[13px] text-ink/70">Score · 점수
            <select value={course.scoreKind} onChange={(e) => setCourse({ ...course, scoreKind: e.target.value as ScoreKind })} className="mt-1 block w-full border-b border-ink/20 bg-transparent py-1 text-[15px]">
              {(Object.keys(SCORE_KINDS) as ScoreKind[]).map((k) => <option key={k} value={k}>{SCORE_KINDS[k].en} · {SCORE_KINDS[k].ko}</option>)}
            </select>
          </label>
          <button type="submit" className={`pb-1 text-[15px] font-semibold ${LINK}`}>+ {T.newCourse.en} · {T.newCourse.ko}</button>
        </form>
      </section>

      <section aria-labelledby="patient-timeline" className="border-t border-ink/10 pt-6">
        <h2 id="patient-timeline" className="mb-3 text-[14.5px] font-semibold text-ink/70"><Term term={T.visits} /></h2>
        <ul>
          {timeline.map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline gap-x-5 border-b border-ink/[0.07] py-2.5 text-[15px]">
              <span className="w-24 font-mono text-[13px] tabular-nums text-ink/60">{v.date}</span>
              <span className="text-inkdeep">{v.procedure}</span>
              <span className="text-ink/70">{VISIT_KIND_LABEL[v.kind].en}{v.kind === "session" && v.sessionNo ? ` ${v.sessionNo}` : ""}</span>
              <span className="text-ink/60">{[v.params, v.photos.length ? `${v.photos.length} photos` : ""].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
