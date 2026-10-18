import type { Flag } from "../../lib/bbip/types";

export function FlagBanner({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <div role="alert" className="mt-4 space-y-1.5">
      {flags.map((flag) => (
        <p
          key={flag.text}
          className={`rounded-xl px-4 py-2 text-sm font-medium ring-1 ${
            flag.level === "contraindication"
              ? "bg-red-50 text-red-800 ring-red-200"
              : "bg-amber-50 text-amber-900 ring-amber-200"
          }`}
        >
          {flag.level === "contraindication" ? "🚨 금기" : "⚠️ 주의"} · {flag.text}
        </p>
      ))}
    </div>
  );
}
