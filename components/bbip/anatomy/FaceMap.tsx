"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ATLAS, ATLAS_VIEWBOX, type AtlasStructure, type Pt, type Shape } from "../../../lib/bbip/anatomy/atlas";
import {
  anchorOf,
  areaFor,
  earFor,
  featuresFor,
  shapesFor,
  smoothPath,
  viewOutline,
} from "../../../lib/bbip/anatomy/geometry";
import { LAYERS, VIEWS, type LayerKey, type ViewKey } from "../../../lib/bbip/anatomy/layers";
import { getRegion, type AnatomyPlan, type RegionKey } from "../../../lib/bbip/anatomy/regions";
import { ReviewBadge } from "./ReviewBadge";
import { depthText, layerColor, RiskPill } from "./vocab";

const { width: W, height: H } = ATLAS_VIEWBOX;

function visibleInCase(s: AtlasStructure, plan: AnatomyPlan): boolean {
  if (plan.muscleOnly) return s.layer === "muscles";
  if (s.layer === "entry") return (s.entryFor ?? []).some((c) => plan.categories.includes(c));
  return true;
}

function ShapeEl({
  shape,
  structure,
  emphasis,
  ids,
}: {
  shape: Shape;
  structure: AtlasStructure;
  emphasis: boolean;
  ids: { hatch: string; arrow: string };
}) {
  const color = layerColor(structure.layer);
  const width = emphasis ? 3 : 1.7;
  if (shape.kind === "point") {
    const [x, y] = shape.at;
    if (structure.layer === "entry") {
      return (
        <g className="atlas-shape">
          <circle cx={x} cy={y} r={emphasis ? 6 : 4.5} fill="white" stroke={color} strokeWidth={1.6} />
          <circle cx={x} cy={y} r={1.6} fill={color} />
        </g>
      );
    }
    return (
      <circle
        className="atlas-shape"
        cx={x}
        cy={y}
        r={emphasis ? 3.8 : 2.8}
        fill={color}
        stroke="white"
        strokeWidth={1}
      />
    );
  }
  if (shape.kind === "vector") {
    const [x1, y1] = shape.from;
    const [x2, y2] = shape.to;
    return (
      <g className="atlas-shape">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={9} />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width}
          strokeDasharray="4 2.5"
          strokeLinecap="round"
          markerEnd={`url(#${ids.arrow})`}
        />
        <circle cx={x1} cy={y1} r={2.6} fill="white" stroke={color} strokeWidth={1.5} />
      </g>
    );
  }
  const d = smoothPath(shape.pts, shape.kind === "area");
  if (shape.kind === "area") {
    const danger = structure.layer === "danger";
    return (
      <path
        className="atlas-shape"
        d={d}
        fill={danger ? `url(#${ids.hatch})` : color}
        fillOpacity={danger ? 0.85 : structure.layer === "fat" ? 0.2 : 0.15}
        stroke={color}
        strokeOpacity={danger ? 0.8 : 0.55}
        strokeWidth={emphasis ? 1.8 : 0.8}
        strokeDasharray={danger ? "3 2" : undefined}
      />
    );
  }
  const dashed = structure.layer === "ligaments" || structure.layer === "ducts";
  return (
    <g className="atlas-shape">
      <path d={d} fill="none" stroke="transparent" strokeWidth={9} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? "4 2.5" : undefined}
      />
    </g>
  );
}

function StructureInfo({
  structure,
  pinned,
  onClose,
}: {
  structure: AtlasStructure;
  pinned: boolean;
  onClose: () => void;
}) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-ink/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serifa text-sm font-bold text-inkdeep">{structure.ko}</p>
          <p className="font-mono text-[10px] text-ink/65">{structure.en}</p>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            aria-label="구조물 정보 닫기"
            className="-mr-1 -mt-1 rounded-full p-1 text-ink/60 transition hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <RiskPill risk={structure.risk} />
        <ReviewBadge structure={structure} />
      </div>
      <p>
        <span className="font-semibold text-ink">주행</span> {structure.course}
      </p>
      <p>
        <span className="font-semibold text-ink">깊이</span> {depthText(structure)} — {structure.depthNote}
      </p>
      <p>
        <span className="font-semibold text-ink">위험</span> {structure.riskNote}
      </p>
      <p>
        <span className="font-semibold text-ink">안전 술기</span> {structure.safeTechnique}
      </p>
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
  const ids = { hatch: `${uid}-hatch`, arrow: `${uid}-arrow` };
  const [hoverId, setHoverId] = useState<string | null>(null);
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

  const outline = useMemo(() => smoothPath(viewOutline(view), true), [view]);
  const guides = useMemo(() => [...earFor(view), ...featuresFor(view)], [view]);
  const regionArea = useMemo(() => areaFor(getRegion(region).area, view), [region, view]);

  const shownId = hoverId ?? focusId;
  const shown = drawn.find((d) => d.structure.id === shownId && d.active);
  const anchor: Pt | null = shown ? anchorOf(shown.shapes) : null;

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
    } else if (event.key === "Escape") {
      onFocus(null);
    }
  }

  const panelId = `${uid}-panel`;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="얼굴 도식 보기" className="inline-flex rounded-full bg-mist p-1">
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
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selected ? "bg-ink text-white shadow-sm" : "text-ink/70 hover:text-ink"
                }`}
              >
                {v.ko}
              </button>
            );
          })}
        </div>
      </div>

      <div role="group" aria-label="레이어" className="mb-3 flex flex-wrap gap-1.5">
        {availableLayers.map((layer) => {
          const on = layers.has(layer.key);
          return (
            <button
              key={layer.key}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleLayer(layer.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition ${
                on ? "bg-white text-ink ring-ink/20" : "bg-transparent text-ink/60 ring-ink/10 hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: on ? layer.color : "transparent", boxShadow: `inset 0 0 0 1.5px ${layer.color}` }}
              />
              {layer.ko}
            </button>
          );
        })}
      </div>
      {plan.muscleOnly && (
        <p className="mb-2 text-[11px] text-ink/70">보톡스 케이스 — 근육 레이어만 표시합니다.</p>
      )}

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${view}`}
        className="relative mx-auto w-full max-w-[380px] rounded-[20px] bg-[#fbf9f5] ring-1 ring-ink/[0.06]"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={`${getRegion(region).ko} 해부 도식 — ${VIEWS.find((v) => v.key === view)!.ko}`}
          className="block h-auto w-full touch-manipulation select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onFocus(null);
          }}
        >
          <defs>
            <pattern id={ids.hatch} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#fee2e2" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="#dc2626" strokeWidth="1.4" strokeOpacity="0.55" />
            </pattern>
            <marker id={ids.arrow} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill={layerColor("entry")} />
            </marker>
          </defs>

          <path d={outline} fill="#f4ede2" stroke="#051A24" strokeOpacity="0.35" strokeWidth="1" />
          {guides.map((shape, i) =>
            shape.kind === "line" || shape.kind === "area" ? (
              <path
                key={i}
                d={smoothPath(shape.pts, shape.kind === "area")}
                fill={shape.kind === "area" ? "#ffffff" : "none"}
                fillOpacity={0.7}
                stroke="#051A24"
                strokeOpacity="0.4"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
            ) : null
          )}
          {regionArea.map((shape, i) =>
            shape.kind === "area" ? (
              <path
                key={i}
                d={smoothPath(shape.pts, true)}
                fill="#10b981"
                fillOpacity="0.08"
                stroke="#047857"
                strokeOpacity="0.55"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null
          )}

          {drawn.map(({ structure, shapes, active }) => {
            const focused = focusId === structure.id;
            const label = `${structure.ko} ${structure.en}`;
            if (!active) {
              return (
                <g key={structure.id} opacity={0.16} aria-hidden="true" pointerEvents="none">
                  {shapes.map((shape, i) => (
                    <ShapeEl key={i} shape={shape} structure={structure} emphasis={false} ids={ids} />
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
                aria-pressed={focused}
                aria-label={label}
                className="atlas-structure cursor-pointer"
                onClick={() => onFocus(focused ? null : structure.id)}
                onKeyDown={(e) => onStructureKey(e, structure.id)}
                onMouseEnter={() => setHoverId(structure.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(structure.id)}
                onBlur={() => setHoverId(null)}
              >
                <title>{label}</title>
                {shapes.map((shape, i) => (
                  <ShapeEl
                    key={i}
                    shape={shape}
                    structure={structure}
                    emphasis={focused || hoverId === structure.id}
                    ids={ids}
                  />
                ))}
              </g>
            );
          })}

          {anchor && focusId && shown?.structure.id === focusId && (
            <circle
              cx={anchor[0]}
              cy={anchor[1]}
              r="8"
              fill="none"
              stroke="#0284c7"
              strokeWidth="1.6"
              className="atlas-pulse"
              pointerEvents="none"
            />
          )}
        </svg>

        {shown && anchor && (
          <div
            className="pointer-events-auto absolute z-10 w-[min(260px,85%)] rounded-2xl bg-white p-3 shadow-[0_18px_45px_rgba(5,26,36,0.18)] ring-1 ring-ink/10"
            style={{
              top: `${Math.min(70, (anchor[1] / H) * 100 + 4)}%`,
              ...(anchor[0] / W > 0.5
                ? { right: `${Math.max(2, 100 - (anchor[0] / W) * 100 + 3)}%` }
                : { left: `${Math.max(2, (anchor[0] / W) * 100 + 3)}%` }),
            }}
            onMouseEnter={() => setHoverId(shown.structure.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <StructureInfo
              structure={shown.structure}
              pinned={focusId === shown.structure.id}
              onClose={() => onFocus(null)}
            />
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {shown ? `${shown.structure.ko}: ${shown.structure.course}. 위험 — ${shown.structure.riskNote}` : ""}
      </p>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-ink/65">
        도식(schematic) — 실제 주행·깊이는 개인차가 큽니다. 시술 전 촉진·초음파로 확인하세요.
      </p>
    </div>
  );
}

function areaFirst(s: AtlasStructure): number {
  return s.layer === "danger" || s.layer === "fat" || s.layer === "muscles" ? 0 : 1;
}
