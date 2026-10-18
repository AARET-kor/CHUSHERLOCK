import { OctagonAlert, TriangleAlert } from "lucide-react";
import type { Flag } from "../../lib/bbip/types";

export function FlagBanner({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <div role="alert" className="mb-8 grid gap-2.5">
      {flags.map((flag) => {
        const contraindication = flag.level === "contraindication";
        const Icon = contraindication ? OctagonAlert : TriangleAlert;
        return (
          <div
            key={flag.text}
            className={`animate-pop-in flex items-start gap-3 rounded-[18px] border px-4 py-3.5 ${
              contraindication ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                contraindication ? "bg-red-600" : "bg-amber-500"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
                  contraindication ? "text-red-700" : "text-amber-800"
                }`}
              >
                {contraindication ? "금기 · Contraindication" : "주의 · Caution"}
              </p>
              <p
                className={`mt-0.5 text-sm font-medium leading-relaxed ${
                  contraindication ? "text-red-900" : "text-amber-950"
                }`}
              >
                {flag.text}
                {flag.source === "model" && (
                  <span
                    title="AI 파서가 추가한 항목 — 확인 필요"
                    className="ml-2 inline-flex items-center rounded-full bg-white/80 px-1.5 py-px align-[0.1em] font-mono text-[10px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200"
                  >
                    AI
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
