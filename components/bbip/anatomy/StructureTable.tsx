"use client";

import Link from "next/link";
import type { AtlasStructure } from "../../../lib/bbip/anatomy/atlas";
import type { NoteRef } from "../../../lib/bbip/types";
import { ReviewBadge } from "./ReviewBadge";
import { depthText, layerColor, LAYER_BY_KEY, RiskPill, sortByRisk } from "./vocab";

/** Session notes whose title names the structure (verified notes only). */
function relatedNotes(s: AtlasStructure, notes: NoteRef[]): NoteRef[] {
  const keys = [s.ko, s.en.replace(/\.$/, ""), ...s.keywords].map((k) => k.toLowerCase()).filter((k) => k.length >= 2);
  return notes.filter((n) => n.verified && keys.some((k) => n.title.toLowerCase().includes(k)));
}

export function StructureTable({
  structures,
  notes,
  focusId,
  onFocus,
}: {
  structures: AtlasStructure[];
  notes: NoteRef[];
  focusId: string | null;
  onFocus: (id: string) => void;
}) {
  const rows = sortByRisk(structures.filter((s) => s.layer !== "entry"));
  if (rows.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="위험 구조물 표"
      tabIndex={0}
      className="overflow-x-auto rounded-[20px] ring-1 ring-ink/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <caption className="sr-only">위험도 순 구조물 — 위치, 깊이, 위험, 안전 술기, 근거</caption>
        <thead className="bg-mist font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">구조물</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">위치</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">깊이</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">위험</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">안전 술기</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">근거</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const focused = focusId === s.id;
            const related = relatedNotes(s, notes);
            return (
              <tr
                key={s.id}
                className={`border-t border-ink/[0.06] align-top transition ${focused ? "bg-sky-50" : "bg-white"}`}
              >
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    aria-pressed={focused}
                    onClick={() => onFocus(s.id)}
                    className="group flex items-start gap-2 text-left"
                  >
                    <span
                      aria-hidden="true"
                      title={LAYER_BY_KEY.get(s.layer)?.ko}
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: layerColor(s.layer) }}
                    />
                    <span>
                      <span className="block font-semibold text-inkdeep underline-offset-2 group-hover:underline">
                        {s.ko}
                      </span>
                      <span className="block font-mono text-[10px] text-ink/65">{s.en}</span>
                    </span>
                  </button>
                </td>
                <td className="max-w-[200px] px-3 py-2.5 text-ink/80">{s.course}</td>
                <td className="max-w-[180px] px-3 py-2.5 text-ink/80">
                  <span className="font-medium text-ink">{depthText(s)}</span>
                  <span className="mt-0.5 block text-[11px] text-ink/65">{s.depthNote}</span>
                </td>
                <td className="max-w-[170px] px-3 py-2.5">
                  <RiskPill risk={s.risk} />
                  <span className="mt-1 block text-[11px] text-ink/70">{s.riskNote}</span>
                </td>
                <td className="max-w-[210px] px-3 py-2.5 text-ink/80">{s.safeTechnique}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <ReviewBadge structure={s} />
                    <span className="text-[10px] text-ink/65">BBIP 아틀라스</span>
                    {related.map((note) => (
                      <Link
                        key={note.id}
                        href={`/entries/${note.id}`}
                        title={note.title}
                        className="ev ev-note"
                      >
                        📚{note.n}
                      </Link>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
