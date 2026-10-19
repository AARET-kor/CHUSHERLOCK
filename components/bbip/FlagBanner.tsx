import type { Flag } from "../../lib/bbip/types";

/** Safety flags as margin-ruled warnings — red for contraindications, amber
 * for cautions. Parser-made flags carry a quiet "AI 판정" note. */
export function FlagBanner({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul role="alert" className="mt-7 space-y-2.5">
      {flags.map((flag) => {
        const contra = flag.level === "contraindication";
        return (
          <li
            key={flag.text}
            className={`border-l-2 py-0.5 pl-4 ${contra ? "border-red-700" : "border-amber-600"}`}
          >
            <span
              className={`mr-3 text-[12px] font-bold ${
                contra ? "text-red-800" : "text-amber-800"
              }`}
            >
              {contra ? "금기" : "주의"}
            </span>
            <span className="text-[14.5px] leading-relaxed text-inkdeep">{flag.text}</span>
            {flag.source === "model" && (
              <span className="ml-2 text-[11px] italic text-ink/50">AI 판정</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
