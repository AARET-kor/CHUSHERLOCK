"use client";

import { displayEn, type AtlasStructure } from "../../../lib/bbip/anatomy/atlas";
import { CATEGORY_LABELS, DEPTHS, type DepthKey, type ProcedureCategory } from "../../../lib/bbip/anatomy/layers";
import type { PlaneSpec } from "../../../lib/bbip/anatomy/regions";
import { layerColor } from "./vocab";

// Vertical layer stack for the active region: skin → periosteum (bone
// below), each structure as a column with a dot in every layer it runs
// through, and the recommended plane as a green band.

const BAND: Record<DepthKey, { h: number; fill: string }> = {
  skin: { h: 22, fill: "#ffffff" },
  subcutaneous: { h: 40, fill: "#fbfaf7" },
  smas: { h: 32, fill: "#f4f2ee" },
  "deep-fat": { h: 34, fill: "#fbfaf7" },
  periosteum: { h: 12, fill: "#ebe8e2" },
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
  depth,
  onDepth,
}: {
  regionLabel: string;
  category: ProcedureCategory;
  plane: PlaneSpec;
  structures: AtlasStructure[];
  focusId: string | null;
  onFocus: (id: string | null) => void;
  depth: DepthKey | null;
  onDepth: (depth: DepthKey | null) => void;
}) {
  // Keep the focused structure in view even when it is outside the first ten.
  const focusedStructure = structures.find((s) => s.id === focusId);
  const cols = structures.slice(0, 10);
  if (focusedStructure && !cols.includes(focusedStructure)) cols[cols.length - 1] = focusedStructure;
  const span = W - LABEL_W - 16;
  const step = cols.length > 1 ? span / cols.length : span;
  const xOf = (i: number) => LABEL_W + 8 + step * (i + 0.5);
  const planeLabel = plane.depths.map((d) => DEPTHS.find((x) => x.key === d)!.ko).join(" · ");

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serifa text-[17px] font-bold text-inkdeep">Depth Section <span className="font-sans text-[14px] font-normal text-ink/65">깊이 단면 · {regionLabel}</span></span>
        <span className="text-[14px] text-[#0f5132]">
          Recommended plane · {CATEGORY_LABELS[category]} 권장 평면: {plane.depths.length ? planeLabel : "없음"}
        </span>
      </figcaption>
      <div className="border-y border-ink/10 py-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={`${regionLabel} 깊이 단면도 — 권장 평면 ${planeLabel || "없음"}`}
          className="mx-auto block h-auto w-full max-w-[760px]"
        >
          {bands.map((b) => (
            <g key={b.key} role="button" tabIndex={0} aria-label={`${b.ko} 층 탐색`} aria-pressed={depth === b.key}
              className="cursor-pointer" onClick={() => onDepth(depth === b.key ? null : b.key)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDepth(depth === b.key ? null : b.key); } }}>
              <rect x={LABEL_W} y={b.y} width={W - LABEL_W - 4} height={b.h} fill={b.fill} />
              <rect x={0} y={b.y} width={W - 4} height={b.h} fill={depth === b.key ? "#051a24" : "transparent"} fillOpacity={depth === b.key ? 0.08 : 0} />
              <line x1={LABEL_W} x2={W - 4} y1={b.y} y2={b.y} stroke="#051a24" strokeOpacity="0.18" strokeWidth="0.6" />
              <text x={LABEL_W - 6} y={b.y + b.h / 2 + 3.5} textAnchor="end" fontSize="10" fill="#22343d">
                {b.ko}
              </text>
            </g>
          ))}
          <rect x={LABEL_W} y={STACK_BOTTOM} width={W - LABEL_W - 4} height={BONE} fill="#dcd8d0" />
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
                fill="#0f5132"
                fillOpacity="0.12"
                stroke="#0f5132"
                strokeOpacity="0.7"
                strokeWidth="1"
                pointerEvents="none"
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
                    fill="#051a24"
                    fillOpacity="0.06"
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
        <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[14px] text-ink/80">
          {cols.map((s, i) => (
            <li key={s.id} className="flex min-w-0 items-center gap-1.5">
              <span className="w-4 text-right font-mono text-[12.5px] text-ink/65">{i + 1}</span>
              <span aria-hidden="true" className="h-2 w-2 shrink-0" style={{ background: layerColor(s.layer) }} />
              <button type="button" onClick={() => onFocus(focusId === s.id ? null : s.id)}
                aria-pressed={focusId === s.id} className={`truncate text-left underline-offset-4 hover:underline ${focusId === s.id ? "font-semibold underline" : ""}`}>{displayEn(s.en)} <span lang="ko" className="text-ink/65">{s.ko}</span></button>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink/70">
        <span className="text-[#0f5132]">초록 띠</span>는 권장 주입·삽입 평면입니다. {plane.note}
      </p>
      <p className="mt-1 text-[12px] text-ink/65">층 이름을 누르면 지도에서 해당 층을 탐색합니다. 두께·간격은 실제 비율이 아닙니다.</p>
    </figure>
  );
}
