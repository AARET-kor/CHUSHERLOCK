"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ATLAS,
  ATLAS_VIEWBOX,
  flowDirection,
  type AtlasStructure,
  type Shape,
} from "../../../lib/bbip/anatomy/atlas";
import { areaFor, earFor, featuresFor, shapesFor, smoothPath, viewOutline } from "../../../lib/bbip/anatomy/geometry";
import {
  DEPTHS,
  FLOW_LABELS,
  FLOWING_LAYERS,
  LAYERS,
  VIEWS,
  type LayerKey,
  type ViewKey,
} from "../../../lib/bbip/anatomy/layers";
import { getRegion, type AnatomyPlan, type RegionKey } from "../../../lib/bbip/anatomy/regions";
import { ReviewBadge } from "./ReviewBadge";
import { LAYER_BY_KEY, layerColor, RiskText, sortByRisk, textToggleClass } from "./vocab";

const { width: W, height: H } = ATLAS_VIEWBOX;

// Atlas-style focus: pointing at a structure dims and blurs everything else,
// so one vessel or nerve can be followed on its own. Pointing previews;
// clicking pins; Escape or clicking empty space clears.

function visibleInCase(s: AtlasStructure, plan: AnatomyPlan): boolean {
  if (plan.muscleOnly) return s.layer === "muscles";
  if (s.layer === "entry") return (s.entryFor ?? []).some((c) => plan.categories.includes(c));
  return true;
}

function casingOf(layer: LayerKey): string {
  return LAYER_BY_KEY.get(layer)?.casing ?? "#ffffff";
}

function ShapeEl({
  shape,
  structure,
  focused,
  ids,
}: {
  shape: Shape;
  structure: AtlasStructure;
  focused: boolean;
  ids: { hatch: string; arrow: (layer: LayerKey) => string };
}) {
  const color = layerColor(structure.layer);
  const casing = casingOf(structure.layer);
  const width = focused ? 3.2 : 1.9;

  if (shape.kind === "point") {
    const [x, y] = shape.at;
    if (structure.layer === "entry") {
      return (
        <g className="atlas-shape">
          <circle cx={x} cy={y} r={focused ? 6.5 : 4.8} fill="white" stroke={color} strokeWidth={1.6} />
          <circle cx={x} cy={y} r={1.7} fill={color} />
        </g>
      );
    }
    return (
      <g className="atlas-shape">
        <circle cx={x} cy={y} r={8} fill="transparent" />
        <circle cx={x} cy={y} r={focused ? 4.4 : 3.2} fill={color} stroke={casing} strokeWidth={1.2} />
      </g>
    );
  }

  if (shape.kind === "vector") {
    const [x1, y1] = shape.from;
    const [x2, y2] = shape.to;
    return (
      <g className="atlas-shape">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={10} />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width - 0.4}
          strokeDasharray="4 2.5"
          strokeLinecap="round"
          markerEnd={`url(#${ids.arrow("entry")})`}
        />
        <circle cx={x1} cy={y1} r={2.6} fill="white" stroke={color} strokeWidth={1.5} />
      </g>
    );
  }

  const area = shape.kind === "area";
  const d = smoothPath(shape.pts, area);
  if (area) {
    const danger = structure.layer === "danger";
    return (
      <path
        className="atlas-shape"
        d={d}
        fill={danger ? `url(#${ids.hatch})` : color}
        fillOpacity={danger ? 0.9 : focused ? 0.28 : structure.layer === "fat" ? 0.12 : 0.16}
        stroke={color}
        strokeOpacity={danger ? 0.9 : 0.75}
        strokeWidth={focused ? 1.8 : 0.9}
        strokeDasharray={danger ? "3 2" : structure.layer === "fat" ? "1 1.5" : undefined}
      />
    );
  }

  const flowing = FLOWING_LAYERS.has(structure.layer);
  const dashed = structure.layer === "ligaments";
  const reverse = flowDirection(structure) === "reverse";
  return (
    <g className="atlas-shape">
      <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
      {/* casing: a halo (white, or dark under yellow) so colors read on white */}
      <path d={d} fill="none" stroke={casing} strokeWidth={width + 1.8} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? "4 2.5" : undefined}
        markerEnd={focused && flowing && !reverse ? `url(#${ids.arrow(structure.layer)})` : undefined}
        markerStart={focused && flowing && reverse ? `url(#${ids.arrow(structure.layer)}-rev)` : undefined}
      />
      {focused && flowing && (
        <path
          d={d}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={structure.layer === "nerves" ? 0.95 : 0.85}
          strokeWidth={1.1}
          strokeLinecap="round"
          className={reverse ? "atlas-flow atlas-flow-reverse" : "atlas-flow"}
        />
      )}
    </g>
  );
}

const DEPTH_INDEX = new Map(DEPTHS.map((d, i) => [d.key, i]));

/** Five-layer strip with the structure's layers filled in its color. */
function DepthStrip({ structure }: { structure: AtlasStructure }) {
  const color = layerColor(structure.layer);
  const on = new Set(structure.depths.map((d) => DEPTH_INDEX.get(d)));
  return (
    <ol aria-label="지나가는 층" className="mt-1.5 grid grid-cols-5 gap-px overflow-hidden rounded-[3px] bg-ink/10">
      {DEPTHS.map((depth, i) => (
        <li
          key={depth.key}
          className="px-1 py-1.5 text-center text-[10px] leading-tight"
          style={
            on.has(i)
              ? { background: color, color: structure.layer === "nerves" ? "#3d2a00" : "#ffffff", fontWeight: 600 }
              : { background: "#ffffff", color: "rgba(5,26,36,0.72)" }
          }
        >
          {depth.ko}
        </li>
      ))}
    </ol>
  );
}

function StructureDetail({
  structure,
  pinned,
  onClose,
}: {
  structure: AtlasStructure;
  pinned: boolean;
  onClose: () => void;
}) {
  const layer = LAYER_BY_KEY.get(structure.layer);
  const flowLabel = FLOW_LABELS[structure.layer];
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[12px] text-ink/70">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: layer?.color }} />
          {layer?.ko}
          <span className="text-ink/30">·</span>
          <RiskText risk={structure.risk} />
        </p>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-ink/65 underline decoration-ink/30 underline-offset-4 hover:text-ink"
          >
            닫기
          </button>
        )}
      </div>
      <h4 className="mt-2 font-serifa text-[23px] font-bold leading-tight text-inkdeep">{structure.ko}</h4>
      <p className="text-[12.5px] italic text-ink/60">{structure.en}</p>

      <dl className="mt-5 space-y-4 text-[13.5px] leading-relaxed text-ink/85">
        <div>
          <dt className="text-[11.5px] font-semibold text-ink/65">{flowLabel ? `주행 · ${flowLabel}` : "위치"}</dt>
          <dd className="mt-0.5">{structure.course}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] font-semibold text-ink/65">깊이</dt>
          <dd>
            <DepthStrip structure={structure} />
            <p className="mt-1.5 text-[12.5px] text-ink/70">{structure.depthNote}</p>
          </dd>
        </div>
        <div className="border-l-2 border-[#e0262c] pl-3">
          <dt className="text-[11.5px] font-semibold text-[#b42318]">잘못되면</dt>
          <dd className="mt-0.5 text-inkdeep">{structure.riskNote}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] font-semibold text-ink/65">안전 술기</dt>
          <dd className="mt-0.5">{structure.safeTechnique}</dd>
        </div>
      </dl>
      <p className="mt-4">
        <ReviewBadge structure={structure} />
      </p>
    </div>
  );
}

function StructureList({
  structures,
  onHover,
  onPick,
}: {
  structures: AtlasStructure[];
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[12.5px] leading-relaxed text-ink/70">
        지도나 목록에서 혈관·신경을 가리키면 나머지가 흐려집니다. 눌러서 고정하고, Esc로 해제하세요.
      </p>
      <ul className="mt-4 border-t border-ink/10">
        {sortByRisk(structures).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onMouseEnter={() => onHover(s.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s.id)}
              onBlur={() => onHover(null)}
              onClick={() => onPick(s.id)}
              className="group flex w-full items-center gap-3 border-b border-ink/[0.07] py-2 text-left"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: layerColor(s.layer), boxShadow: `0 0 0 1px ${casingOf(s.layer)}` }}
              />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink underline-offset-4 group-hover:underline">
                {s.ko}
              </span>
              <RiskText risk={s.risk} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FaceMap({
  plan,
  region,
  regionIds,
  view,
  onViewChange,
  layers,
  onToggleLayer,
  focusId,
  onFocus,
}: {
  plan: AnatomyPlan;
  region: RegionKey;
  /** Structures of the active region for this case (highlighted, focusable). */
  regionIds: Set<string>;
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  layers: Set<LayerKey>;
  onToggleLayer: (layer: LayerKey) => void;
  focusId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { hatch: `${uid}-hatch`, arrow: (layer: LayerKey) => `${uid}-arrow-${layer}` };
  // Pointing on the map previews in the panel; pointing in the list only
  // lights the map (the list stays put under the cursor).
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [listHoverId, setListHoverId] = useState<string | null>(null);
  const tabRefs = useRef<Partial<Record<ViewKey, HTMLButtonElement | null>>>({});

  const availableLayers = plan.muscleOnly ? LAYERS.filter((l) => l.key === "muscles") : LAYERS;

  const drawn = useMemo(
    () =>
      ATLAS.filter((s) => visibleInCase(s, plan) && layers.has(s.layer))
        .map((s) => ({ structure: s, shapes: shapesFor(s, view), active: regionIds.has(s.id) }))
        .filter((d) => d.shapes.length > 0)
        // Areas under lines; the active region on top of the dimmed rest.
        .sort((a, b) => Number(a.active) - Number(b.active) || areaFirst(a.structure) - areaFirst(b.structure)),
    [plan, layers, view, regionIds]
  );
  const listable = useMemo(() => drawn.filter((d) => d.active).map((d) => d.structure), [drawn]);

  const outline = useMemo(() => smoothPath(viewOutline(view), true), [view]);
  const guides = useMemo(() => [...earFor(view), ...featuresFor(view)], [view]);
  const regionArea = useMemo(() => areaFor(getRegion(region).area, view), [region, view]);

  const findActive = (id: string | null) => drawn.find((d) => d.structure.id === id && d.active)?.structure ?? null;
  const activeId = hoverId ?? listHoverId ?? focusId;
  const active = findActive(activeId);
  const pinned = findActive(focusId);
  const shown = findActive(hoverId) ?? pinned;
  const focusing = active !== null;

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = VIEWS[(index + step + VIEWS.length) % VIEWS.length]!.key;
    onViewChange(next);
    tabRefs.current[next]?.focus();
  }

  function onStructureKey(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onFocus(focusId === id ? null : id);
    }
  }

  const panelId = `${uid}-panel`;
  const arrowLayers = LAYERS.filter((l) => FLOWING_LAYERS.has(l.key) || l.key === "entry");

  return (
    <div
      className="min-w-0"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setHoverId(null);
          setListHoverId(null);
          onFocus(null);
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div role="tablist" aria-label="얼굴 도식 보기" className="flex items-baseline gap-4">
          {VIEWS.map((v, index) => {
            const selected = v.key === view;
            return (
              <button
                key={v.key}
                ref={(el) => {
                  tabRefs.current[v.key] = el;
                }}
                id={`${uid}-tab-${v.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onViewChange(v.key)}
                onKeyDown={(e) => onTabKey(e, index)}
                className={textToggleClass(selected)}
              >
                {v.ko}
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="레이어" className="flex flex-wrap gap-x-4 gap-y-1.5">
          {availableLayers.map((layer) => {
            const on = layers.has(layer.key);
            return (
              <button
                key={layer.key}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleLayer(layer.key)}
                className={`inline-flex items-center gap-1.5 text-[12px] transition ${
                  on ? "text-inkdeep" : "text-ink/65 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full transition"
                  style={{
                    background: on ? layer.color : "transparent",
                    boxShadow: `inset 0 0 0 1.5px ${layer.color}`,
                    opacity: on ? 1 : 0.6,
                  }}
                />
                {layer.ko}
              </button>
            );
          })}
        </div>
      </div>
      {plan.muscleOnly && <p className="mb-3 text-[12px] text-ink/70">보톡스 케이스라 근육 레이어만 표시합니다.</p>}

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${view}`}
          className="relative mx-auto w-full max-w-[400px] rounded-[18px] bg-[#fbf7f2]"
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={`${getRegion(region).ko} 해부 도식 — ${VIEWS.find((v) => v.key === view)!.ko}`}
            data-focusing={focusing ? "true" : undefined}
            className="atlas-svg block h-auto w-full touch-manipulation select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) onFocus(null);
            }}
          >
            <defs>
              <pattern id={ids.hatch} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="#fff5f4" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="#e0262c" strokeWidth="1" strokeOpacity="0.55" />
              </pattern>
              {arrowLayers.map((layer) => (
                <g key={layer.key}>
                  <marker
                    id={ids.arrow(layer.key)}
                    viewBox="0 0 6 6"
                    refX="4.5"
                    refY="3"
                    markerWidth="4.5"
                    markerHeight="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 z" fill={layer.color} stroke={layer.casing} strokeWidth="0.6" />
                  </marker>
                  <marker
                    id={`${ids.arrow(layer.key)}-rev`}
                    viewBox="0 0 6 6"
                    refX="1.5"
                    refY="3"
                    markerWidth="4.5"
                    markerHeight="4.5"
                    orient="auto"
                  >
                    <path d="M6,0 L0,3 L6,6 z" fill={layer.color} stroke={layer.casing} strokeWidth="0.6" />
                  </marker>
                </g>
              ))}
            </defs>

            <g className="atlas-backdrop">
              <path d={outline} fill="#fffdfb" stroke="#051a24" strokeOpacity="0.5" strokeWidth="1" />
              {guides.map((shape, i) =>
                shape.kind === "line" || shape.kind === "area" ? (
                  <path
                    key={i}
                    d={smoothPath(shape.pts, shape.kind === "area")}
                    fill="none"
                    stroke="#051a24"
                    strokeOpacity="0.35"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                ) : null
              )}
              {regionArea.map((shape, i) =>
                shape.kind === "area" ? (
                  <path
                    key={i}
                    d={smoothPath(shape.pts, true)}
                    fill="#051a24"
                    fillOpacity="0.03"
                    stroke="#051a24"
                    strokeOpacity="0.35"
                    strokeWidth="0.8"
                    strokeDasharray="2 2.5"
                  />
                ) : null
              )}
            </g>

            {drawn.map(({ structure, shapes, active: inRegion }) => {
              const isActive = structure.id === activeId;
              const label = `${structure.ko} ${structure.en}`;
              if (!inRegion) {
                return (
                  <g key={structure.id} className="atlas-offregion" aria-hidden="true" pointerEvents="none">
                    {shapes.map((shape, i) => (
                      <ShapeEl key={i} shape={shape} structure={structure} focused={false} ids={ids} />
                    ))}
                  </g>
                );
              }
              return (
                <g
                  key={structure.id}
                  data-structure={structure.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={focusId === structure.id}
                  aria-label={label}
                  className={`atlas-structure cursor-pointer ${isActive ? "atlas-on" : "atlas-off"}`}
                  style={isActive ? { ["--atlas-glow" as string]: layerColor(structure.layer) } : undefined}
                  onClick={() => onFocus(focusId === structure.id ? null : structure.id)}
                  onKeyDown={(e) => onStructureKey(e, structure.id)}
                  onMouseEnter={() => setHoverId(structure.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(structure.id)}
                  onBlur={() => setHoverId(null)}
                >
                  <title>{label}</title>
                  {shapes.map((shape, i) => (
                    <ShapeEl key={i} shape={shape} structure={structure} focused={isActive} ids={ids} />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        <aside aria-label="구조물 정보" className="min-w-0 md:pt-1">
          {shown ? (
            <StructureDetail
              key={shown.id}
              structure={shown}
              pinned={pinned?.id === shown.id}
              onClose={() => onFocus(null)}
            />
          ) : (
            <StructureList
              structures={listable}
              onHover={setListHoverId}
              onPick={(id) => {
                setListHoverId(null);
                onFocus(focusId === id ? null : id);
              }}
            />
          )}
        </aside>
      </div>

      <p aria-live="polite" className="sr-only">
        {shown ? `${shown.ko}: ${shown.course}. 잘못되면 — ${shown.riskNote}` : ""}
      </p>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink/65">
        도식입니다. 실제 주행과 깊이는 개인차가 크니 시술 전 촉진·초음파로 확인하세요.
      </p>
    </div>
  );
}

function areaFirst(s: AtlasStructure): number {
  return s.layer === "danger" || s.layer === "fat" || s.layer === "muscles" ? 0 : 1;
}
