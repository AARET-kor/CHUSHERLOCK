// components/papers/AnalyzeButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Analyze one paper now. Outside the weekly 5; the server refuses repeats. */
export function AnalyzeButton({ pmid, retry = false }: { pmid: string; retry?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/papers/${pmid}/analyze`, { method: "POST" });
    if (!res.ok) setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "분석에 실패했습니다.");
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={() => void run()} className="btn-secondary !px-3 !py-1 text-[13px]">
        {busy ? "Analyzing · 분석 중…" : retry ? "Retry · 다시 분석" : "Analyze · 분석"}
      </button>
      {error && <span role="alert" className="text-[13px] text-red-800">{error}</span>}
    </span>
  );
}
