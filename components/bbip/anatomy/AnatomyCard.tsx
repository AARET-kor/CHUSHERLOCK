"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Info } from "lucide-react";
import { getStructure, isReviewed } from "../../../lib/bbip/anatomy/atlas";
import { shapesFor } from "../../../lib/bbip/anatomy/geometry";
import { CATEGORY_LABELS, type LayerKey, type ProcedureCategory, type ViewKey } from "../../../lib/bbip/anatomy/layers";
import {
  getRegion,
  regionsContaining,
  regionStructures,
  type AnatomyPlan,
  type RegionKey,
} from "../../../lib/bbip/anatomy/regions";
import type { NoteRef } from "../../../lib/bbip/types";
import { SectionHeading } from "../SectionHeading";
import { DepthCrossSection } from "./DepthCrossSection";
import { FaceMap } from "./FaceMap";
import { MyFigures } from "./MyFigures";
import { StructureTable } from "./StructureTable";
import { sortByRisk } from "./vocab";

/** A focus request from outside the card (an {{atlas:id}} chip). */
export interface AtlasFocusRequest {
  id: string;
  nonce: number;
}

const DEFAULT_LAYERS: LayerKey[] = ["arteries", "veins", "nerves", "ducts", "danger", "entry"];

function defaultLayers(plan: AnatomyPlan): Set<LayerKey> {
  return new Set(plan.muscleOnly ? ["muscles"] : DEFAULT_LAYERS);
}

const chipClass = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    on ? "bg-ink text-white shadow-[0_8px_20px_rgba(5,26,36,0.12)]" : "bg-white text-ink/75 ring-1 ring-inset ring-ink/15 hover:text-ink"
  }`;

export function AnatomyCard({
  sessionId,
  plan,
  index,
  notes,
  focusRequest,
}: {
  sessionId: string;
  plan: AnatomyPlan;
  index: string;
  notes: NoteRef[];
  focusRequest: AtlasFocusRequest | null;
}) {
  const [region, setRegion] = useState<RegionKey>(plan.regions[0]!);
  const [category, setCategory] = useState<ProcedureCategory>(plan.categories[0]!);
  const [view, setView] = useState<ViewKey>("front");
  const [layers, setLayers] = useState<Set<LayerKey>>(() => defaultLayers(plan));
  const [focusId, setFocusId] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  const structures = useMemo(() => regionStructures(region, plan), [region, plan]);
  const regionIds = useMemo(() => new Set(structures.map((s) => s.id)), [structures]);
  const regionDef = getRegion(region);
  const drafts = structures.filter((s) => !isReviewed(s)).length;

  const depthColumns = useMemo(
    () =>
      sortByRisk(
        structures.filter((s) =>
          plan.muscleOnly ? s.layer === "muscles" : ["arteries", "veins", "nerves", "ducts"].includes(s.layer)
        )
      ),
    [structures, plan.muscleOnly]
  );

  // An atlas chip in a card: switch to a region and view that show the
  // structure, make its layer visible, focus it and bring the map into view.
  useEffect(() => {
    if (!focusRequest) return;
    const structure = getStructure(focusRequest.id);
    if (!structure) return;
    const target = regionsContaining(structure.id, plan.regions).find((key) =>
      regionStructures(key, plan).some((s) => s.id === structure.id)
    );
    if (!target) return;
    setRegion(target);
    setLayers((current) => (current.has(structure.layer) ? current : new Set([...current, structure.layer])));
    setView((current) => (shapesFor(structure, current).length > 0 ? current : "front"));
    setFocusId(structure.id);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusRequest, plan]);

  function toggleLayer(layer: LayerKey) {
    setLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  function focusFromTable(id: string) {
    const structure = getStructure(id);
    if (structure && !layers.has(structure.layer)) toggleLayer(structure.layer);
    setFocusId(id);
  }

  return (
    <section ref={ref} aria-labelledby="bbip-anatomy" className="mt-12 scroll-mt-6">
      <SectionHeading
        id="bbip-anatomy"
        index={index}
        kicker="Anatomy map"
        meta={
          drafts > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-300">
              원장 검토 전 초안 {drafts}/{structures.length}
            </span>
          ) : undefined
        }
      >
        해부 <span className="italic">지도</span>
      </SectionHeading>

      <article className="animate-pop-in overflow-hidden rounded-[24px] border border-ink/10 bg-white shadow-[0_16px_45px_rgba(5,26,36,0.06)]">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/[0.07] px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <Compass aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/65">
                {plan.categories.map((c) => CATEGORY_LABELS[c]).join(" · ")} · {regionDef.en}
              </p>
              <h3 className="font-serifa text-lg font-bold leading-snug text-inkdeep">
                {regionDef.ko} — 위험 구조물과 권장 층
              </h3>
            </div>
          </div>
          <p className="flex max-w-sm items-start gap-1.5 text-[11px] leading-relaxed text-ink/70">
            <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            AI가 그린 위치가 아니라 큐레이션 아틀라스입니다. AI 호출 없이 바로 표시됩니다.
          </p>
        </header>

        <div className="space-y-3 px-5 pt-4 md:px-6">
          <div role="group" aria-label="부위" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">부위</span>
            {plan.regions.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === region}
                onClick={() => {
                  setRegion(key);
                  setFocusId(null);
                }}
                className={chipClass(key === region)}
              >
                {getRegion(key).ko}
              </button>
            ))}
          </div>
          {plan.categories.length > 1 && (
            <div role="group" aria-label="시술" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">시술</span>
              {plan.categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === category}
                  onClick={() => setCategory(c)}
                  className={chipClass(c === category)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 px-5 py-5 md:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <FaceMap
            plan={plan}
            region={region}
            regionIds={regionIds}
            view={view}
            onViewChange={setView}
            layers={layers}
            onToggleLayer={toggleLayer}
            focusId={focusId}
            onFocus={setFocusId}
          />
          <DepthCrossSection
            regionLabel={regionDef.ko}
            category={category}
            plane={regionDef.planes[category]}
            structures={depthColumns}
            focusId={focusId}
            onFocus={setFocusId}
          />
        </div>

        <div className="px-5 pb-5 md:px-6">
          <StructureTable structures={structures} notes={notes} focusId={focusId} onFocus={focusFromTable} />
          <MyFigures sessionId={sessionId} />
        </div>
      </article>
    </section>
  );
}
