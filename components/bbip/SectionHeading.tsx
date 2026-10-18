import type { ReactNode } from "react";

/** Cognitio-style section header: mono kicker + serif h2. */
export function SectionHeading({
  id,
  index,
  kicker,
  meta,
  children,
}: {
  id?: string;
  index: string;
  kicker: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/65">
          <span>[ {index} ]</span>
          <span className="font-bold text-ink">{kicker}</span>
        </div>
        <h2 id={id} className="font-serifa text-2xl font-bold tracking-tight text-inkdeep">
          {children}
        </h2>
      </div>
      {meta}
    </div>
  );
}
