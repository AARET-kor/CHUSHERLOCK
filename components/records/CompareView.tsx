"use client";

import { PhotoCompareCanvas } from "./PhotoCompareCanvas";
import { analysisIsCurrent } from "../../lib/records/analysis";
import { useState } from "react";
import { compareFacts } from "../../lib/records/compareFacts";
import { comparePair, sharedAngles, visitLabel } from "../../lib/records/progress";
import { ANGLE_LABEL, type Angle, type CourseRecord, type Visit, type VisitWithPhotos } from "../../lib/records/types";

const LINK = "underline decoration-ink/25 underline-offset-4 hover:decoration-ink";
const SELECT = "border-b border-ink/20 bg-transparent py-1 text-[15px] text-ink";

/** Two visits at one angle: side by side or under a slider, plus the
 * on-request AI change analysis with a confirm step showing what is sent. */
export function CompareView({ course, onVisit }: { course: CourseRecord; onVisit: (visit: Visit) => void }) {
  const initial = comparePair(course.visits);
  const [fromId, setFromId] = useState(initial?.fromId ?? "");
  const [toId, setToId] = useState(initial?.toId ?? "");
  const [chosenAngle, setAngle] = useState<Angle | null>(initial?.angle ?? null);
  const [mode, setMode] = useState<"side" | "slider">("side");
  const [photoChoices, setPhotoChoices] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withPhotos = course.visits.filter((v) => v.photos.length > 0);
  if (!initial || withPhotos.length < 2) return null;
  const from = withPhotos.find((v) => v.id === fromId) ?? withPhotos[0]!;
  const to = withPhotos.find((v) => v.id === toId) ?? withPhotos.at(-1)!;
  const angles = from.id === to.id ? [] : sharedAngles(from, to);
  const angle = chosenAngle && angles.includes(chosenAngle) ? chosenAngle : (angles[0] ?? null);
  const thumb = (v: VisitWithPhotos) => v.photos.find(p => p.angle === angle && p.id === photoChoices[`${v.id}:${angle}`]) ?? v.photos.find(p => p.angle === angle);
  const analysis = to.aiAnalysis && to.aiAnalysis.fromVisitId === from.id && to.aiAnalysis.angle === angle ? to.aiAnalysis : null;
  const stale = analysis ? (!analysisIsCurrent(course, to.id, analysis) || analysis.fromPhotoId !== thumb(from)?.id || analysis.toPhotoId !== thumb(to)?.id) : false;
  const facts = angle ? compareFacts(course, from.id, to.id, angle) : "";


  async function analyze() {
    if (!angle) return;
    setRunning(true);
    setError(null);
    const res = await fetch("/api/records/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromVisitId: from.id, toVisitId: to.id, angle, fromPhotoId: thumb(from)?.id, toPhotoId: thumb(to)?.id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setRunning(false);
    if (!res?.ok || !data?.visit) return setError(data?.error ?? "AI 분석에 실패했습니다.");
    setConfirming(false);
    onVisit(data.visit);
  }

  async function mergeIntoNote() {
    const res = await fetch(`/api/records/visits/${to.id}/merge-analysis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysisId: analysis?.id }) }).catch(() => null);
    if (!res) return setError("연결에 실패했습니다. 다시 시도해 주세요.");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.visit) onVisit(data.visit);
    else setError(data.error ?? "메모에 합치지 못했습니다.");
  }

  return (
    <section aria-labelledby="course-compare" className="border-t border-ink/10 pb-8 pt-6">
      <h2 id="course-compare" className="mb-4 text-[14.5px] font-semibold text-ink/70">
        Compare <span className="block text-[0.75em] font-normal">사진 비교</span>
      </h2>
      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block text-[13px] text-ink/70">
          Before · 이전
          <select disabled={running} value={from.id} onChange={(e) => (setFromId(e.target.value), setConfirming(false))} className={`mt-1 block ${SELECT}`}>
            {withPhotos.map((v) => (
              <option key={v.id} value={v.id}>
                {visitLabel(v)} · {v.date}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] text-ink/70">
          After · 이후
          <select disabled={running} value={to.id} onChange={(e) => (setToId(e.target.value), setConfirming(false))} className={`mt-1 block ${SELECT}`}>
            {withPhotos.map((v) => (
              <option key={v.id} value={v.id}>
                {visitLabel(v)} · {v.date}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="비교 각도" className="flex flex-wrap gap-1">
          {angles.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={a === angle}
              disabled={running} onClick={() => { setAngle(a); setConfirming(false); }}
              className={`rounded-full px-3 py-1 text-[13.5px] ${a === angle ? "bg-inkdeep text-white" : "bg-mist text-ink hover:bg-ink/10"}`}
            >
              {ANGLE_LABEL[a].en} · {ANGLE_LABEL[a].ko}
            </button>
          ))}
        </div>
        <div role="group" aria-label="비교 방식" className="ml-auto flex gap-1 rounded-full bg-mist p-1 text-[13.5px]">
          {(["side", "slider"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? "bg-inkdeep text-white" : "text-ink hover:bg-white"}`}
            >
              {m === "side" ? "Side by side · 나란히" : "Slider · 슬라이더"}
            </button>
          ))}
        </div>
      </div>

      {angle && <div className="mb-4 flex flex-wrap gap-4">{[from, to].map((v, i) => <label key={i} className="text-sm">{i ? "이후 사진 선택" : "이전 사진 선택"}<select disabled={running} aria-label={i ? "이후 사진 선택" : "이전 사진 선택"} className="ml-2 border-b bg-transparent" value={thumb(v)?.id} onChange={e => { setPhotoChoices(old => ({ ...old, [`${v.id}:${angle}`]: e.target.value })); setConfirming(false); }}>{v.photos.filter(p => p.angle === angle).map((p, n) => <option key={p.id} value={p.id}>사진 {n + 1} · {p.createdAt.slice(0, 10)}</option>)}</select></label>)}</div>}
      {!angle ? <p className="text-sm text-ink/65">두 방문에 같은 각도의 사진이 없습니다. 다른 방문을 골라 보세요.</p> : <PhotoCompareCanvas key={`${thumb(from)!.id}:${thumb(to)!.id}`} before={thumb(from)!} after={thumb(to)!} mode={mode} beforeLabel={`${visitLabel(from)} · ${from.date}`} afterLabel={`${visitLabel(to)} · ${to.date}`} />}

      {angle && (
        <div className="mt-5 max-w-[760px]">
          {!confirming && (
            <button type="button" onClick={() => setConfirming(true)} className={`text-[15px] font-semibold ${LINK}`}>
              {analysis ? "Analyze again · 다시 분석" : "AI change analysis · AI 변화 분석"}
            </button>
          )}
          {confirming && (
            <div className="rounded-[6px] border border-ink/15 p-4">
              <p className="text-[14.5px] font-semibold text-inkdeep">이 사진 2장과 아래 정보가 Claude로 전송됩니다.</p>
              <p className="mt-1 text-[13px] text-ink/65">차트번호·별칭·메모·진료 결과는 보내지 않습니다. 결과는 AI 초안으로 이후 방문에 저장됩니다.</p>
              <div className="mt-3 flex gap-3">
                {[from, to].map((v) => (
                  <img key={v.id} src={`/api/records/photos/${thumb(v)!.id}?size=thumb`} alt={`${visitLabel(v)} 전송 사진`} className="h-20 w-20 rounded-[3px] object-cover" />
                ))}
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded bg-mist/70 p-3 font-sans text-[13.5px] text-ink/85">{facts}</pre>
              <div className="mt-3 flex gap-5 text-[15px]">
                <button type="button" disabled={running} onClick={() => void analyze()} className={`font-semibold ${LINK} disabled:text-ink/40`}>
                  {running ? "분석 중…" : "Send · 보내기"}
                </button>
                <button type="button" disabled={running} onClick={() => setConfirming(false)} className={`text-ink/70 ${LINK}`}>
                  Cancel · 취소
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-[14px] text-red-800">{error}</p>}
          {analysis && (
            <div className="mt-4 rounded-[6px] bg-mist/60 px-4 py-3">
              <p className="text-[13px] font-semibold text-[#8a5a00]">
                AI change analysis · AI 변화 분석 <span className="font-normal italic">— AI 초안, 원장 확인 필요</span>
              </p>
              {stale && <p role="status" className="mt-2 text-amber-800">사진 또는 시술 정보가 달라졌습니다. 다시 분석해 주세요.</p>}
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink/85">{analysis.text}</p>
              <button type="button" disabled={stale || Boolean(analysis.mergedAt)} onClick={() => void mergeIntoNote()} className={`mt-2 text-[14px] text-ink/75 ${LINK}`}>
                {analysis.mergedAt ? "메모에 반영됨" : "Add to note · 메모에 합치기"}
              </button>
            </div>
          )}
        </div>
      )}
      {to.aiAnalysis && <details className="mt-5 rounded border border-ink/15 p-4"><summary className="cursor-pointer text-sm font-medium">분석 이력 ({1 + (to.aiAnalysis.history?.length ?? 0)})</summary><div className="mt-3 space-y-4">{[to.aiAnalysis, ...(to.aiAnalysis.history ?? [])].map((a, i) => <article key={a.id ?? i} className="border-t border-ink/10 pt-3"><p className="text-xs text-ink/65">{a.createdAt} · {ANGLE_LABEL[a.angle].ko} · {a.model}{a.mergedAt ? " · 메모 반영됨" : " · AI 초안"}</p><p className="mt-2 whitespace-pre-wrap text-sm">{a.text}</p><details className="mt-2 text-xs"><summary className="cursor-pointer">분석 당시 정보</summary><pre className="whitespace-pre-wrap">{a.facts ?? "이전 버전: 입력 정보가 저장되지 않았습니다."}</pre></details></article>)}</div></details>}
    </section>
  );
}
