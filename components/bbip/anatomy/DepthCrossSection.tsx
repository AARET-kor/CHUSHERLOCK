"use client";

import type { AtlasStructure } from "../../../lib/bbip/anatomy/atlas";
import { CATEGORY_LABELS, DEPTHS, type DepthKey, type ProcedureCategory } from "../../../lib/bbip/anatomy/layers";
import type { PlaneSpec } from "../../../lib/bbip/anatomy/regions";
import { layerColor } from "./vocab";

// Vertical layer stack for the active region: skin → periosteum (bone
// below), each structure as a column with a dot in every layer it runs
// through, and the recommended plane as a green band.

const BAND: Record<DepthKey, { h: number; fill: string }> = {
  skin: { h: 22, fill: "#f6d9cc" },
  subcutaneous: { h: 40, fill: "#fbecc4" },
  smas: { h: 32, fill: "#f2c9cf" },
  "deep-fat": { h: 34, fill: "#fde6b8" },
  periosteum: { h: 12, fill: "#e6e1d8" },
};
const LABEL_W = 92;
const TOP = 8;
const W = 340;
const BONE = 18;

const bands = (() => {
  let y = TOP;
  return DEPTHS.map((d) => {
    const band = { key: d.key, ko: d.ko, y, h: BAND[d.key].h, fill: BAND[d.key].fill };
    y += band.h;
    return band;
  });
})();
const BAND_BY_KEY = new Map(bands.map((b) => [b.key, b]));
const STACK_BOTTOM = bands[bands.length - 1]!.y + bands[bands.length - 1]!.h;
const H = STACK_BOTTOM + BONE + 8;

export function DepthCrossSection({
  regionLabel,
  category,
  plane,
  structures,
  focusId,
  onFocus,
}: {
  regionLabel: string;
  category: ProcedureCategory;
  plane: PlaneSpec;
  structures: AtlasStructure[];
  focusId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const cols = structures.slice(0, 10);
  const span = W - LABEL_W - 16;
  const step = cols.length > 1 ? span / cols.length : span;
  const xOf = (i: number) => LABEL_W + 8 + step * (i + 0.5);
  const planeLabel = plane.depths.map((d) => DEPTHS.find((x) => x.key === d)!.ko).join(" · ");

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">Depth · {regionLabel}</span>
        <span className="text-[11px] font-medium text-emerald-800">
          {CATEGORY_LABELS[category]} 권장 평면: {plane.depths.length ? planeLabel : "—"}
        </span>
      </figcaption>
      <div className="rounded-[20px] bg-white p-2 ring-1 ring-ink/[0.06]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={`${regionLabel} 깊이 단면도 — 권장 평면 ${planeLabel || "없음"}`}
          className="block h-auto w-full"
        >
          {bands.map((b) => (
            <g key={b.key}>
              <rect x={LABEL_W} y={b.y} width={W - LABEL_W - 4} height={b.h} fill={b.fill} />
              <text x={LABEL_W - 6} y={b.y + b.h / 2 + 3.5} textAnchor="end" fontSize="10" fill="#22343d">
                {b.ko}
              </text>
            </g>
          ))}
          <rect x={LABEL_W} y={STACK_BOTTOM} width={W - LABEL_W - 4} height={BONE} fill="#d6d3cd" />
          <text x={LABEL_W - 6} y={STACK_BOTTOM + BONE / 2 + 3.5} textAnchor="end" fontSize="10" fill="#22343d">
            뼈
          </text>

          {plane.depths.map((d) => {
            const b = BAND_BY_KEY.get(d)!;
            return (
              <rect
                key={d}
                x={LABEL_W}
                y={b.y + 1}
                width={W - LABEL_W - 4}
                height={b.h - 2}
                fill="#10b981"
                fillOpacity="0.28"
                stroke="#047857"
                strokeWidth="1.4"
                strokeDasharray="5 3"
                rx="3"
              />
            );
          })}

          {cols.map((s, i) => {
            const x = xOf(i);
            const ys = s.depths.map((d) => {
              const b = BAND_BY_KEY.get(d)!;
              return b.y + b.h / 2;
            });
            const color = layerColor(s.layer);
            const focused = focusId === s.id;
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={focused}
                aria-label={`${i + 1}. ${s.ko} — ${s.depths.map((d) => BAND_BY_KEY.get(d)!.ko).join(", ")}`}
                className="atlas-structure cursor-pointer"
                onClick={() => onFocus(focused ? null : s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFocus(focused ? null : s.id);
                  }
                }}
              >
                <title>{`${s.ko} (${s.en})`}</title>
                <rect x={x - step / 2} y={TOP} width={step} height={STACK_BOTTOM - TOP} fill="transparent" />
                {focused && (
                  <rect
                    x={x - Math.min(step / 2, 12)}
                    y={TOP}
                    width={Math.min(step, 24)}
                    height={STACK_BOTTOM - TOP}
                    fill="#0284c7"
                    fillOpacity="0.12"
                    rx="4"
                  />
                )}
                {ys.length > 1 && (
                  <line
                    className="atlas-shape"
                    x1={x}
                    y1={Math.min(...ys)}
                    x2={x}
                    y2={Math.max(...ys)}
                    stroke={color}
                    strokeWidth={focused ? 3 : 2}
                    strokeLinecap="round"
                  />
                )}
                {ys.map((y, j) => (
                  <circle key={j} cx={x} cy={y} r={focused ? 5 : 4} fill={color} stroke="white" strokeWidth="1.2" />
                ))}
                <text x={x} y={STACK_BOTTOM + BONE / 2 + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#22343d">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 px-1 text-[11px] text-ink/80">
          {cols.map((s, i) => (
            <li key={s.id} className="flex min-w-0 items-center gap-1.5">
              <span className="font-mono font-bold text-ink">{i + 1}</span>
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: layerColor(s.layer) }} />
              <span className="truncate">{s.ko}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink/70">
        <span className="font-semibold text-emerald-800">초록 밴드</span> = 권장 주입·삽입 평면. {plane.note}
      </p>
    </figure>
  );
}
