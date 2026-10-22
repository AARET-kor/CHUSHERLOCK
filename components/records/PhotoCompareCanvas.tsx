"use client";
import { useState, type CSSProperties } from "react";
import type { Photo } from "../../lib/records/types";
type Pose = { zoom: number; x: number; y: number };
const origin = (): Pose => ({ zoom: 1, x: 0, y: 0 });
export function PhotoCompareCanvas({ before, after, mode, beforeLabel, afterLabel }: { before: Photo; after: Photo; mode: "side" | "slider"; beforeLabel: string; afterLabel: string }) {
  const [poses, setPoses] = useState([origin(), origin()]);
  const [split, setSplit] = useState(50);
  const style = (index: number): CSSProperties => { const p = poses[index]!; return { transform: `translate(${p.x}%, ${p.y}%) scale(${p.zoom})` }; };
  const img = (photo: Photo, index: number) => <img src={`/api/records/photos/${photo.id}`} alt={index ? afterLabel : beforeLabel} className="h-full w-full object-contain" style={style(index)} />;
  return <div className="max-w-[760px]">
    {mode === "side" ? <div className="grid grid-cols-2 gap-3">{[before, after].map((p, i) => <figure key={p.id}><div className="aspect-[3/4] overflow-hidden rounded bg-mist">{img(p, i)}</div><figcaption className="mt-1 text-xs">{i ? afterLabel : beforeLabel}</figcaption></figure>)}</div> : <div className="max-w-[420px]">
      <div className="relative aspect-[3/4] overflow-hidden rounded bg-mist">
        <div className="absolute inset-0">{img(after, 1)}</div>
        <div className="absolute inset-0 bg-mist" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>{img(before, 0)}</div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${split}%` }} />
        <span className="absolute left-2 top-2 bg-white/80 p-1 text-xs">이전</span><span className="absolute right-2 top-2 bg-white/80 p-1 text-xs">이후</span>
      </div>
      <label className="mt-2 block text-sm">비교 슬라이더<input aria-label="비교 슬라이더" type="range" min={0} max={100} value={split} onChange={e => setSplit(Number(e.target.value))} className="w-full" /></label>
    </div>}
    <details className="my-3 rounded border border-ink/15 p-3"><summary className="cursor-pointer text-sm">확대 · 위치 맞추기</summary>
      <p className="my-2 text-xs text-ink/65">화면 표시만 조절합니다. AI에는 선택한 원본 사진이 전송됩니다.</p>
      <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map(i => <fieldset key={i}><legend className="text-sm font-medium">{i ? "이후 사진" : "이전 사진"}</legend>{([['zoom', '확대', 1, 3, 0.05], ['x', '좌우', -50, 50, 1], ['y', '상하', -50, 50, 1]] as const).map(([key, label, min, max, step]) => <label key={key} className="mt-2 block text-xs">{label} {poses[i]![key]}<input aria-label={`${i ? "이후" : "이전"} ${label}`} className="block w-full" type="range" min={min} max={max} step={step} value={poses[i]![key]} onChange={e => setPoses(old => old.map((p, n) => n === i ? { ...p, [key]: Number(e.target.value) } : p))} /></label>)}</fieldset>)}</div>
      <button type="button" className="mt-3 text-sm underline" onClick={() => setPoses([origin(), origin()])}>위치·확대 초기화</button>
    </details>
  </div>;
}
