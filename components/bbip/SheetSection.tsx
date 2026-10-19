/** One block of the consult sheet: a margin column (index, label, note) and
 * the body. Hairline rules separate blocks the way a printed chart would. */
export function SheetSection({
  id,
  index,
  label,
  note,
  children,
  className = "",
}: {
  id: string;
  index: string;
  label: React.ReactNode;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`animate-fade-in-up grid gap-x-10 gap-y-4 border-t border-ink/10 pb-10 pt-7 md:grid-cols-[160px_minmax(0,1fr)] ${className}`}
    >
      <header className="md:pt-0.5">
        <p className="font-mono text-[11px] tabular-nums text-ink/45">{index}</p>
        <h2 id={id} className="mt-1 break-keep font-serifa text-[17px] font-bold leading-snug text-inkdeep">
          {label}
        </h2>
        {note && <div className="mt-2 text-[11.5px] leading-relaxed text-ink/60">{note}</div>}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
