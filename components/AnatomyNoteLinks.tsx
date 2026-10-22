"use client";
import { useState } from "react";
import { ATLAS } from "../lib/bbip/anatomy/atlas";
export function AnatomyNoteLinks({ entryId, tags }: { entryId: string; tags: string[] }) {
  const [linked, setLinked] = useState(tags);
  const [selected, setSelected] = useState(ATLAS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(structureId: string, enabled: boolean) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/entries/${entryId}/anatomy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ structureId, linked: enabled }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "연결 실패");
      setLinked(data.tags);
    } catch (e) { setError(e instanceof Error ? e.message : "연결 실패"); }
    finally { setBusy(false); }
  }
  return <section className="mb-8 rounded-xl border border-ink/15 p-4">
    <h2 className="font-semibold">해부 지도에 연결</h2><p className="mt-1 text-xs text-ink/65">직접 연결한 노트와 도판이 해당 구조를 선택할 때 표시됩니다.</p>
    <div className="my-3 flex flex-wrap gap-2"><select aria-label="연결할 해부 구조" value={selected} onChange={e => setSelected(e.target.value)} className="field max-w-full" disabled={busy}>{ATLAS.map(s => <option key={s.id} value={s.id}>{s.ko} · {s.en}</option>)}</select><button type="button" disabled={busy || linked.includes(`anatomy:${selected}`)} onClick={() => void save(selected, true)} className="btn-secondary disabled:opacity-40">연결</button></div>
    <ul className="space-y-2">{ATLAS.filter(s => linked.includes(`anatomy:${s.id}`)).map(s => <li key={s.id} className="flex flex-wrap items-center gap-3 text-sm"><span>{s.ko}</span><button type="button" disabled={busy} className="underline" onClick={() => void save(s.id, false)} aria-label={`${s.ko} 연결 해제`}>해제</button></li>)}</ul>
    {error && <p role="alert" className="mt-2 text-red-800">{error}</p>}
  </section>;
}
