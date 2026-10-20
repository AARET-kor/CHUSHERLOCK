"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStructure, isReviewed } from "../../../lib/bbip/anatomy/atlas";
import { shapesFor } from "../../../lib/bbip/anatomy/geometry";
import { CATEGORY_LABELS, LAYERS, type DepthKey, type LayerKey, type ProcedureCategory, type ViewKey } from "../../../lib/bbip/anatomy/layers";
import {
  anatomyPlanFor,
  getRegion,
  regionsContaining,
  regionStructures,
  REGION_KEYS,
  type AnatomyPlan,
  type RegionKey,
} from "../../../lib/bbip/anatomy/regions";
import type { BbipSession, NoteRef } from "../../../lib/bbip/types";
import { SheetSection } from "../SheetSection";
import { DepthCrossSection } from "./DepthCrossSection";
import { FaceMap } from "./FaceMap";
import { ExplorerControls, type ExplorerMode } from "./ExplorerControls";
import { MyFigures } from "./MyFigures";
import { StructureTable } from "./StructureTable";
import { sortByRisk, textToggleClass } from "./vocab";

const DEFAULT_LAYERS: LayerKey[] = ["arteries", "veins", "nerves", "ducts", "danger", "entry"];

function defaultLayers(plan: AnatomyPlan): Set<LayerKey> {
  return new Set(plan.muscleOnly ? ["muscles"] : DEFAULT_LAYERS);
}

/** Whether the session gets an anatomy map — deterministic from its chips. */
export function hasAnatomyMap(session: Pick<BbipSession, "chips">): boolean {
  return anatomyPlanFor(session.chips) !== null;
}

/** The consult sheet's anatomy block. Renders from the session chips alone
 * (no AI call); renders nothing when no procedure maps to the atlas. */
export function AnatomySection({
  session,
  index,
  notes,
}: {
  session: Pick<BbipSession, "id" | "chips">;
  index: string;
  notes: NoteRef[];
}) {
  const plan = useMemo(() => anatomyPlanFor(session.chips), [session.chips]);
  if (!plan) return null;
  return <AnatomyMap key={session.id} sessionId={session.id} plan={plan} index={index} notes={notes} />;
}

function AnatomyMap({
  sessionId,
  plan,
  index,
  notes,
}: {
  sessionId: string;
  plan: AnatomyPlan;
  index: string;
  notes: NoteRef[];
}) {
  const [region, setRegion] = useState<RegionKey>(plan.regions[0]!);
  const [category, setCategory] = useState<ProcedureCategory>(plan.categories[0]!);
  const [view, setView] = useState<ViewKey>("front");
  const [layers, setLayers] = useState<Set<LayerKey>>(() => defaultLayers(plan));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [mode, setMode] = useState<ExplorerMode>("clinical");
  const [depth, setDepth] = useState<DepthKey | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const displayPlan = useMemo(() => mode === "explore" ? { ...plan, muscleOnly: false } : plan, [plan, mode]);

  const structures = useMemo(() => regionStructures(region, displayPlan), [region, displayPlan]);
  const regionIds = useMemo(() => new Set(structures.map((s) => s.id)), [structures]);
  const regionDef = getRegion(region);
  const drafts = structures.filter((s) => !isReviewed(s)).length;
  const searchable = useMemo(() => Array.from(new Map(
    REGION_KEYS.flatMap((key) => regionStructures(key, displayPlan)).map((s) => [s.id, s])
  ).values()), [displayPlan]);
  const shownRegions = plan.regions.includes(region) ? plan.regions : [...plan.regions, region];

  const depthColumns = useMemo(
    () =>
      sortByRisk(
        structures.filter((s) => s.layer !== "entry" && s.layer !== "danger")
      ),
    [structures]
  );

  // Switch to a region and view that show the structure, make its layer
  // visible and focus it.
  const focusStructure = useCallback(
    (id: string, scroll: boolean) => {
      const structure = getStructure(id);
      if (!structure) return;
      const target = [region, ...regionsContaining(structure.id, plan.regions)].find((key) =>
        regionStructures(key, displayPlan).some((s) => s.id === structure.id)
      );
      if (!target) return;
      setRegion(target);
      setDepth((current) => current && !structure.depths.includes(current) ? null : current);
      setLayers((current) => (current.has(structure.layer) ? current : new Set([...current, structure.layer])));
      setView((current) => (shapesFor(structure, current).length > 0 ? current : "front"));
      setFocusId(structure.id);
      if (scroll) bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [plan, displayPlan, region]
  );

  // {{atlas:id}} references in the sheet's cards are rendered as
  // <button data-atlas> by lib/bbip/evidence.ts; listening at the document
  // keeps the card components untouched.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const ref = target?.closest?.<HTMLElement>("button[data-atlas]");
      if (!ref || bodyRef.current?.contains(ref)) return;
      const id = ref.dataset.atlas;
      if (id) focusStructure(id, true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [focusStructure]);

  function toggleLayer(layer: LayerKey) {
    setLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  function changeMode(next: ExplorerMode) {
    setMode(next);
    setDepth(null);
    setZoomed(next === "explain");
    const nextLayers = next === "explore"
      ? new Set(LAYERS.map((l) => l.key))
      : next === "explain"
        ? new Set<LayerKey>(plan.muscleOnly ? ["muscles"] : ["arteries", "nerves", "danger"])
        : defaultLayers(plan);
    const focused = focusId ? getStructure(focusId) : undefined;
    if (focused && (next === "explore" || !plan.muscleOnly || focused.layer === "muscles")) {
      nextLayers.add(focused.layer);
    } else {
      setFocusId(null);
    }
    setLayers(nextLayers);
  }

  return (
    <SheetSection
      id="bbip-anatomy"
      index={index}
      label="해부 지도"
      note={
        <>
          {plan.categories.map((c) => CATEGORY_LABELS[c]).join(" · ")} 시술 부위의 위험 구조물과 권장 층. AI가 그린
          위치가 아니라 큐레이션 아틀라스입니다.
          {drafts > 0 && (
            <span className="mt-1.5 block italic text-[#8a5a00]">
              원장 검토 전 초안 {drafts}/{structures.length}
            </span>
          )}
        </>
      }
    >
      <div ref={bodyRef} className="scroll-mt-6">
        <div className="mb-5 space-y-2 border-b border-ink/10 pb-4">
          <div role="group" aria-label="부위" className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
            <span className="w-8 shrink-0 text-[14px] text-ink/65">부위</span>
            {shownRegions.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === region}
                onClick={() => {
                  setRegion(key);
                  setFocusId(null);
                }}
                className={textToggleClass(key === region)}
              >
                {getRegion(key).ko}
              </button>
            ))}
            <label className="ml-auto text-[13px] text-ink/70">
              <span className="sr-only">다른 부위 탐색</span>
              <select aria-label="다른 부위 탐색" value={region}
                onChange={(e) => { setRegion(e.target.value as RegionKey); setFocusId(null); }}
                className="max-w-full rounded-lg border border-ink/15 bg-white px-2 py-1.5">
                {REGION_KEYS.map((key) => <option key={key} value={key}>{getRegion(key).ko}</option>)}
              </select>
            </label>
          </div>
          {plan.regionsGuessed && (
            <p role="note" className="text-[14px] text-amber-900">
              부위를 알아보지 못해 기본 부위를 보여 줍니다 — 부위를 고르세요.
            </p>
          )}
          {plan.categories.length > 1 && (
            <div role="group" aria-label="시술" className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
              <span className="w-8 shrink-0 text-[14px] text-ink/65">시술</span>
              {plan.categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === category}
                  onClick={() => setCategory(c)}
                  className={textToggleClass(c === category)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>

        <h3 className="mb-4 font-serifa text-[23px] font-bold leading-snug text-inkdeep">
          {regionDef.ko} <span className="font-sans text-[15px] font-normal text-ink/65">{regionDef.en}</span>
        </h3>

        <ExplorerControls mode={mode} onMode={changeMode} depth={depth} onDepth={(next) => { setDepth(next); setFocusId(null); }}
          structures={searchable} onPick={(id) => focusStructure(id, false)} />

        <div className="space-y-12">
          <FaceMap
            plan={displayPlan}
            region={region}
            regionIds={regionIds}
            view={view}
            onViewChange={setView}
            layers={layers}
            onToggleLayer={toggleLayer}
            focusId={focusId}
            onFocus={setFocusId}
            depth={depth}
            zoomed={zoomed}
            onZoomChange={setZoomed}
            structures={structures}
            onPickRelated={(id) => focusStructure(id, false)}
            explain={mode === "explain"}
          />
          <DepthCrossSection
            regionLabel={regionDef.ko}
            category={category}
            plane={regionDef.planes[category]}
            structures={depthColumns}
            focusId={focusId}
            onFocus={(id) => id ? focusStructure(id, false) : setFocusId(null)}
            depth={depth}
            onDepth={(next) => { setDepth(next); setFocusId(null); }}
          />
        </div>

        <div className="mt-8">
          <StructureTable
            structures={structures}
            notes={notes}
            focusId={focusId}
            onFocus={(id) => focusStructure(id, false)}
          />
        </div>
        <MyFigures sessionId={sessionId} />
      </div>
    </SheetSection>
  );
}
