import { T } from "../../lib/bbip/terms";
import type { Flag } from "../../lib/bbip/types";
import { Term } from "./Term";

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
            className={`flex items-start gap-3 border-l-2 py-0.5 pl-4 ${contra ? "border-red-700" : "border-amber-600"}`}
          >
            <span
              className={`w-[108px] shrink-0 pt-0.5 text-[14px] font-bold ${
                contra ? "text-red-800" : "text-amber-800"
              }`}
            >
              <Term term={contra ? T.contraindication : T.caution} />
            </span>
            <span className="text-[16.5px] leading-relaxed text-inkdeep">
              {flag.text}
              {flag.source === "model" && (
                <span className="ml-2 text-[12.5px] italic text-ink/60">
                  {T.aiJudged.en} · {T.aiJudged.ko}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
