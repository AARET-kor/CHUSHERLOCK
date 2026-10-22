"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getStructure } from "../../../lib/bbip/anatomy/atlas";
type Note = { id: string; title: string; status: string; excerpt: string; figures: { id: string; caption: string; page: number | null }[] };
export function StructureNotes({ id }: { id: string | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setNotes([]); setStatus("loading");
    fetch(`/api/anatomy/${id}/notes`, { signal: controller.signal }).then(async res => { if (!res.ok) throw new Error(); return res.json(); }).then(data => { setNotes(data.notes); setStatus("ready"); }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [id]);
  if (!id) return null;
  return <section className="mt-6 rounded-lg border border-ink/15 p-4" aria-label="구조 연결 자료">
    <h3 className="font-semibold">{getStructure(id)?.ko} · 연결한 지식</h3>
    {status === "loading" ? <p role="status">자료를 불러오는 중…</p> : status === "error" ? <p role="alert">자료를 불러오지 못했습니다. 구조를 다시 선택해 주세요.</p> : notes.length === 0 ? <p className="mt-2 text-sm text-ink/65">연결된 노트가 없습니다. <Link href="/kb" className="underline">지식창고</Link>의 노트에서 해부 구조를 연결하세요.</p> : <ul className="mt-3 space-y-4">{notes.map(n => <li key={n.id}>
      <Link className="font-medium underline" href={`/entries/${n.id}`}>{n.title}</Link><span className="ml-2 text-xs">{n.status === "reviewed" ? "검토 완료" : "검토 대기"}</span><p className="mt-1 text-sm text-ink/65">{n.excerpt}</p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">{n.figures.map(f => <a key={f.id} href={`/api/figures/${f.id}`} target="_blank" rel="noreferrer"><img src={`/api/figures/${f.id}`} alt={f.caption} loading="lazy" className="h-28 w-full object-contain" /><span className="text-xs">{f.caption}{f.page ? ` · p.${f.page}` : ""}</span></a>)}</div>
    </li>)}</ul>}
  </section>;
}
