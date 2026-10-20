import type { BiTerm } from "../../lib/bbip/terms";

/** A label English-first, the Korean term in small type under it. Sizes
 * follow the surrounding text; the Korean line is 75% of it. */
export function Term({
  term,
  className = "",
  koClassName = "",
}: {
  term: BiTerm;
  className?: string;
  koClassName?: string;
}) {
  return (
    <span className={`inline-flex flex-col leading-[1.15] ${className}`}>
      <span lang="en">{term.en}</span>
      <span lang="ko" className={`mt-0.5 text-[0.75em] font-normal not-italic tracking-normal ${koClassName}`}>
        {term.ko}
      </span>
    </span>
  );
}
