"use client";

import { useEffect, useRef, useState } from "react";
import { progressRows, type ProgressRow } from "../../lib/records/progress";
import { GAIS_LABEL, SCORE_KINDS, type CourseRecord } from "../../lib/records/types";

// Course progress as two small line charts — GAIS (doctor, patient) and the
// indication score — never one chart with two y-scales. Colors are the
// validated categorical slots 1–2 (light mode; the app has no dark mode).
// "Better" always points up: GAIS 1 and lower-is-better scores sit on top.

const SERIES_COLOR = { gaisDoctor: "#2a78d6", gaisPatient: "#eb6834", score: "#2a78d6" } as const;
type SeriesKey = keyof typeof SERIES_COLOR;

interface Series {
  key: SeriesKey;
  name: string;
}

// Drawn at the container's real pixel width, so 12px text stays 12px.
const H = 200;
const PAD = { l: 36, r: 16, t: 14, b: 30 };
const PLOT_H = H - PAD.t - PAD.b;
const FONT = 12;

function ticks(min: number, max: number): number[] {
  const step = max - min <= 5 ? 1 : Math.ceil((max - min) / 4);
  const out: number[] = [];
  for (let v = min; v <= max; v += step) out.push(v);
  if (out.at(-1) !== max) out.push(max);
  return out;
}

function LineChart({
  id,
  title,
  axisNote,
  rows,
  series,
  min,
  max,
  invert,
  format,
}: {
  id: string;
  title: string;
  axisNote: string;
  rows: ProgressRow[];
  series: Series[];
  min: number;
  max: number;
  /** true: smaller values plot higher (better is lower). */
  invert: boolean;
  format: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [W, setW] = useState(520);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const PLOT_W = W - PAD.l - PAD.r;
  const n = rows.length;
  const x = (i: number) => PAD.l + (n === 1 ? PLOT_W / 2 : (i * PLOT_W) / (n - 1));
  const y = (v: number) =>
    invert ? PAD.t + ((v - min) / (max - min)) * PLOT_H : PAD.t + ((max - v) / (max - min)) * PLOT_H;
  const band = n === 1 ? PLOT_W : PLOT_W / (n - 1);
  const shown = series.filter((s) => rows.some((r) => r[s.key] !== null));
  const row = active === null ? null : rows[active]!;

  return (
    <figure className="min-w-0" aria-labelledby={`${id}-title`}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span id={`${id}-title`} className="text-[14.5px] font-semibold text-inkdeep">
          {title}
        </span>
        <span className="text-[12.5px] text-ink/65">{axisNote}</span>
      </figcaption>
      {shown.length > 1 && (
        <ul className="mb-1 flex gap-4 text-[13px] text-ink/75" aria-label={`${title} 범례`}>
          {shown.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-[2px] w-4" style={{ background: SERIES_COLOR[s.key] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={box} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="group" aria-label={`${title} 경과 그래프`}>
          {ticks(min, max).map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#051a24" strokeOpacity="0.08" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={FONT} fill="#4b5a61">
                {format(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => (
            <text key={r.visitId} x={x(i)} y={H - 10} textAnchor="middle" fontSize={FONT} fill="#4b5a61">
              {r.label}
            </text>
          ))}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={PAD.t + PLOT_H} stroke="#051a24" strokeOpacity="0.35" />
          )}
          {shown.map((s) => {
            const points = rows.flatMap((r, i) => (r[s.key] === null ? [] : [[x(i), y(r[s.key]!)] as const]));
            return (
              <g key={s.key}>
                {points.length > 1 && (
                  <polyline
                    points={points.map(([px, py]) => `${px},${py}`).join(" ")}
                    fill="none"
                    stroke={SERIES_COLOR[s.key]}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {points.map(([px, py], i) => (
                  <circle key={i} cx={px} cy={py} r="4" fill={SERIES_COLOR[s.key]} stroke="#ffffff" strokeWidth="2" />
                ))}
              </g>
            );
          })}
          {rows.map((r, i) => (
            <rect
              key={r.visitId}
              x={x(i) - band / 2}
              y={PAD.t}
              width={band}
              height={PLOT_H}
              fill="transparent"
              role="img"
              tabIndex={0}
              aria-label={`${r.label} ${r.date}: ${shown
                .map((s) => `${s.name} ${r[s.key] === null ? "없음" : format(r[s.key]!)}`)
                .join(", ")}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none focus-visible:stroke-ink/40"
            />
          ))}
        </svg>
        {row && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 min-w-[140px] rounded-[6px] border border-ink/10 bg-white px-3 py-2 text-[13px] shadow-sm"
            style={{
              left: `${(x(active) / W) * 100}%`,
              transform: `translateX(${active > n / 2 ? "-105%" : "5%"})`,
            }}
          >
            <p className="text-[12px] text-ink/65">
              {row.label} · {row.date}
            </p>
            {shown.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-[2px] w-3" style={{ background: SERIES_COLOR[s.key] }} />
                <span className="font-semibold text-inkdeep">{row[s.key] === null ? "—" : format(row[s.key]!)}</span>
                <span className="text-ink/65">{s.name}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/** The course's progress charts plus a table view of every value. */
export function ProgressCharts({ course }: { course: CourseRecord }) {
  const rows = progressRows(course.visits);
  const kind = SCORE_KINDS[course.scoreKind];
  const hasGais = rows.some((r) => r.gaisDoctor !== null || r.gaisPatient !== null);
  const hasScore = course.scoreKind !== "none" && rows.some((r) => r.score !== null);
  if (!hasGais && !hasScore) return null;

  return (
    <section aria-labelledby="course-progress" className="border-t border-ink/10 pb-8 pt-6">
      <h2 id="course-progress" className="mb-4 text-[14.5px] font-semibold text-ink/70">
        Progress <span className="block text-[0.75em] font-normal">경과</span>
      </h2>
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {hasGais && (
          <LineChart
            id="chart-gais"
            title="GAIS"
            axisNote="↑ 좋아짐 (1 = 매우 좋아짐, 5 = 악화)"
            rows={rows.filter((r) => r.gaisDoctor !== null || r.gaisPatient !== null)}
            series={[
              { key: "gaisDoctor", name: "원장" },
              { key: "gaisPatient", name: "환자" },
            ]}
            min={1}
            max={5}
            invert
            format={(v) => String(v)}
          />
        )}
        {hasScore && (
          <LineChart
            id="chart-score"
            title={`${kind.en} · ${kind.ko}`}
            axisNote={kind.better === "lower" ? "↑ 좋아짐 (낮을수록 좋음)" : "↑ 좋아짐 (높을수록 좋음)"}
            rows={rows.filter((r) => r.score !== null)}
            series={[{ key: "score", name: kind.en }]}
            min={kind.min}
            max={kind.max}
            invert={kind.better === "lower"}
            format={(v) => String(v)}
          />
        )}
      </div>
      <details className="mt-4 text-[14px]">
        <summary className="cursor-pointer text-ink/70 underline decoration-ink/20 underline-offset-4">
          Table view · 표로 보기
        </summary>
        <table className="mt-2 w-full max-w-[640px] text-left text-[14px]">
          <thead className="text-[12.5px] text-ink/65">
            <tr>
              <th scope="col" className="py-1">Visit · 방문</th>
              <th scope="col">Date · 날짜</th>
              <th scope="col">GAIS 원장</th>
              <th scope="col">GAIS 환자</th>
              {course.scoreKind !== "none" && <th scope="col">{kind.en}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.visitId} className="border-t border-ink/[0.07]">
                <td className="py-1">{r.label}</td>
                <td className="font-mono text-[13px]">{r.date}</td>
                <td>{r.gaisDoctor === null ? "—" : `${r.gaisDoctor} ${GAIS_LABEL[r.gaisDoctor as 1].ko}`}</td>
                <td>{r.gaisPatient === null ? "—" : `${r.gaisPatient} ${GAIS_LABEL[r.gaisPatient as 1].ko}`}</td>
                {course.scoreKind !== "none" && <td>{r.score ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
