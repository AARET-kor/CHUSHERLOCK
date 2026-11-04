// components/papers/FilterChips.tsx
import Link from "next/link";

/** One filter row: plain links, so filters live in the URL and need no JS. */
export function FilterChips({
  label,
  options,
  value,
  hrefFor,
}: {
  label: string;
  options: Array<{ value: string | undefined; text: string }>;
  value: string | undefined;
  hrefFor: (value: string | undefined) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
      <span className="mr-1 text-[12.5px] text-ink/60">{label}</span>
      {options.map((option) => (
        <Link
          key={option.text}
          href={hrefFor(option.value)}
          aria-current={value === option.value ? "true" : undefined}
          className={`rounded-full border px-2.5 py-0.5 ${value === option.value ? "border-inkdeep bg-inkdeep text-white" : "border-ink/15 text-ink hover:bg-mist"}`}
        >
          {option.text}
        </Link>
      ))}
    </nav>
  );
}
