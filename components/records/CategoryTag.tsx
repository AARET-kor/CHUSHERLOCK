import { classifyProcedure, majorOf, type Classification } from "../../lib/records/taxonomy";

/** Procedure as a colored tag: major (one hue per family) › mid › minor.
 * `extra` is a short suffix such as "7/10". `done` marks a finished course
 * (dashed outline, same colors — never color alone). `compact` keeps only
 * the major and its most specific level, for narrow lists. */
export function CategoryTag({
  procedure,
  classification,
  extra,
  done = false,
  size = "md",
  compact = false,
}: {
  procedure: string;
  classification?: Classification;
  extra?: string;
  done?: boolean;
  size?: "sm" | "md";
  compact?: boolean;
}) {
  const c = classification ?? classifyProcedure(procedure);
  const m = majorOf(c.major);
  const all = [c.mid, c.minor].filter(Boolean) as string[];
  const parts = compact ? all.slice(-1) : all;
  return (
    <span
      title={procedure}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border leading-tight ${
        size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]"
      } ${done ? "border-dashed" : ""}`}
      style={{ background: m.color.bg, borderColor: m.color.border, color: m.color.text }}
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color.dot }} />
      <span className="font-semibold">{m.en}</span>
      <span className="truncate">
        {compact ? <span className="sr-only">{m.ko}</span> : m.ko}
        {parts.map((p, i) => (
          <span key={p}>
            {(i > 0 || !compact) && <span className="mx-1">›</span>}
            {p}
          </span>
        ))}
      </span>
      {extra && <span className="font-mono text-[0.92em]">{extra}</span>}
      {done && <span className="sr-only">(완료)</span>}
    </span>
  );
}

/** Patient features ("40대 여성 · 기미 · 와파린") as quiet neutral tags. */
export function FeatureTags({ features, size = "md" }: { features: string; size?: "sm" | "md" }) {
  const parts = features
    .split(/\s*·\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((p) => (
        <span
          key={p}
          className={`inline-flex items-center rounded-full bg-mist text-ink/80 ${size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]"}`}
        >
          {p}
        </span>
      ))}
    </>
  );
}
