"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import { depthText, layerColor, RiskText, textToggleClass } from "./vocab";

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
  const width = emphasis ? 2.8 : 1.5;
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
        fillOpacity={danger ? 0.9 : structure.layer === "fat" ? 0.06 : 0.1}
        stroke={color}
        strokeOpacity={danger ? 0.85 : 0.6}
        strokeWidth={emphasis ? 1.6 : 0.7}
        strokeDasharray={danger ? "3 2" : structure.layer === "fat" ? "1 1.5" : undefined}
      />
    );
  }
  const dashed = structure.layer === "ligaments" || structure.layer === "ducts" || structure.layer === "nerves";
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
    <div className="space-y-1.5 text-[12.5px] leading-relaxed text-ink/80">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-serifa text-[15px] font-bold text-inkdeep">
          {structure.ko} <span className="font-sans text-[11.5px] font-normal text-ink/65">{structure.en}</span>
        </p>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[11.5px] text-ink/65 underline decoration-ink/30 underline-offset-4 hover:text-ink"
          >
            닫기
          </button>
        )}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3 border-b border-ink/10 pb-1.5">
        <RiskText risk={structure.risk} />
        <ReviewBadge structure={structure} />
      </p>
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
      </div>

      <div role="group" aria-label="레이어" className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
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
                className="h-2.5 w-2.5"
                style={{ background: on ? layer.color : "transparent", boxShadow: `inset 0 0 0 1px ${layer.color}` }}
              />
              {layer.ko}
            </button>
          );
        })}
      </div>
      {plan.muscleOnly && (
        <p className="mb-3 text-[12px] text-ink/70">보톡스 케이스라 근육 레이어만 표시합니다.</p>
      )}

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${view}`}
        className="relative mx-auto w-full max-w-[380px] bg-white"
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
              <rect width="5" height="5" fill="#ffffff" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="#b42318" strokeWidth="1" strokeOpacity="0.6" />
            </pattern>
            <marker id={ids.arrow} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill={layerColor("entry")} />
            </marker>
          </defs>

          <path d={outline} fill="#ffffff" stroke="#051a24" strokeOpacity="0.55" strokeWidth="1" />
          {guides.map((shape, i) =>
            shape.kind === "line" || shape.kind === "area" ? (
              <path
                key={i}
                d={smoothPath(shape.pts, shape.kind === "area")}
                fill="none"
                stroke="#051a24"
                strokeOpacity="0.4"
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
                fillOpacity="0.035"
                stroke="#051a24"
                strokeOpacity="0.45"
                strokeWidth="0.8"
                strokeDasharray="2 2.5"
              />
            ) : null
          )}

          {drawn.map(({ structure, shapes, active }) => {
            const focused = focusId === structure.id;
            const label = `${structure.ko} ${structure.en}`;
            if (!active) {
              return (
                <g key={structure.id} opacity={0.14} aria-hidden="true" pointerEvents="none">
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
              stroke="#051a24"
              strokeWidth="1.2"
              className="atlas-pulse"
              pointerEvents="none"
            />
          )}
        </svg>

        {shown && anchor && (
          <div
            className="pointer-events-auto absolute z-10 w-[min(270px,85%)] border border-ink/20 bg-white p-3 shadow-[0_10px_30px_rgba(5,26,36,0.08)]"
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
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink/65">
        도식입니다. 실제 주행과 깊이는 개인차가 크니 시술 전 촉진·초음파로 확인하세요.
      </p>
    </div>
  );
}

function areaFirst(s: AtlasStructure): number {
  return s.layer === "danger" || s.layer === "fat" || s.layer === "muscles" ? 0 : 1;
}
