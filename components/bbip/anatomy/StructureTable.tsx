"use client";

import Link from "next/link";
import type { AtlasStructure } from "../../../lib/bbip/anatomy/atlas";
import type { NoteRef } from "../../../lib/bbip/types";
import { ReviewBadge } from "./ReviewBadge";
import { depthText, layerColor, LAYER_BY_KEY, RiskText, sortByRisk } from "./vocab";
import { displayEn } from "../../../lib/bbip/anatomy/atlas";
import { structureFunction, TERRITORY_LABEL } from "../../../lib/bbip/anatomy/functions";
import { Term } from "../Term";

/** Session notes whose title names the structure (verified notes only). */
function relatedNotes(s: AtlasStructure, notes: NoteRef[]): NoteRef[] {
  const keys = [s.ko, s.en.replace(/\.$/, ""), ...s.keywords].map((k) => k.toLowerCase()).filter((k) => k.length >= 2);
  return notes.filter((n) => n.verified && keys.some((k) => n.title.toLowerCase().includes(k)));
}

/** Risk-sorted structures, set like the sheet's prose tables. */
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
      className="bbip-prose overflow-x-auto focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink/40"
    >
      <table className="min-w-[760px]">
        <caption className="sr-only">위험도 순 구조물 — 위치, 깊이, 위험, 안전 술기, 근거</caption>
        <thead>
          <tr>
            <th scope="col"><Term term={{ en: "Structure", ko: "구조물" }} /></th>
            <th scope="col"><Term term={{ en: "Location", ko: "위치" }} /></th>
            <th scope="col"><Term term={{ en: "Depth", ko: "깊이" }} /></th>
            <th scope="col"><Term term={{ en: "Risk", ko: "위험" }} /></th>
            <th scope="col"><Term term={{ en: "Safe Technique", ko: "안전 술기" }} /></th>
            <th scope="col"><Term term={{ en: "Source", ko: "근거" }} /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const focused = focusId === s.id;
            const related = relatedNotes(s, notes);
            return (
              <tr key={s.id} className={focused ? "bg-[#f4f2ee]" : undefined}>
                <td>
                  <button
                    type="button"
                    aria-pressed={focused}
                    onClick={() => onFocus(s.id)}
                    className="group flex items-baseline gap-2 text-left"
                  >
                    <span
                      aria-hidden="true"
                      title={LAYER_BY_KEY.get(s.layer)?.ko}
                      className="h-2 w-2 shrink-0 translate-y-[-1px]"
                      style={{ background: layerColor(s.layer) }}
                    />
                    <span>
                      <span className="block font-semibold text-inkdeep underline-offset-4 group-hover:underline">
                        {displayEn(s.en)}
                      </span>
                      <span lang="ko" className="block text-[14px] text-ink/65">{s.ko}</span>
                    </span>
                  </button>
                </td>
                <td className="max-w-[200px] text-ink/80">
                  {s.course}
                  {structureFunction(s.id) && (
                    <span className="mt-1.5 block text-[14px] text-ink/70">
                      <b className="font-semibold text-ink/80">{TERRITORY_LABEL[s.layer]?.en}</b> {structureFunction(s.id)!.territory}
                    </span>
                  )}
                </td>
                <td className="max-w-[180px]">
                  {depthText(s)}
                  <span className="block text-[14px] text-ink/65">{s.depthNote}</span>
                </td>
                <td className="max-w-[170px]">
                  <RiskText risk={s.risk} />
                  <span className="block text-[14px] text-ink/70">{s.riskNote}</span>
                </td>
                <td className="max-w-[210px] text-ink/80">{s.safeTechnique}</td>
                <td>
                  <ReviewBadge structure={s} />
                  <span className="block text-[14px] text-ink/65">
                    BBIP Atlas
                    {related.map((note) => (
                      <Link key={note.id} href={`/entries/${note.id}`} title={note.title} className="ev ev-note">
                        {note.n}
                      </Link>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
