// components/papers/SyncBar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SyncRun } from "../../lib/papers/types";

const POLL_MS = 3000;

/** Last collection, and a button to collect now (it spends no analyses). */
export function SyncBar({ initial }: { initial: SyncRun | null }) {
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const running = run !== null && run.finishedAt === null;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const body = (await (await fetch("/api/papers/sync")).json()) as { run: SyncRun | null };
      setRun(body.run);
      if (body.run?.finishedAt) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  async function start() {
    setError(null);
    const res = await fetch("/api/papers/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "manual" }),
    });
    const body = (await res.json()) as { run?: SyncRun; error?: string };
    if (body.run) setRun(body.run);
    else setError(body.error ?? "수집을 시작하지 못했습니다.");
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[14px] text-ink/70">
      <span>
        {running
          ? "Collecting · 수집 중…"
          : run
            ? `Last sync · 마지막 수집 ${run.startedAt.slice(0, 10)} · 새 논문 ${run.added}편`
            : "Not synced yet · 아직 수집 전"}
      </span>
      {run?.error && !running && <span role="alert" className="text-red-800">수집 실패: {run.error}</span>}
      {error && <span role="alert" className="text-red-800">{error}</span>}
      <button type="button" disabled={running} onClick={() => void start()} className="btn-secondary !px-3 !py-1 text-[13px]">
        Sync now · 지금 수집
      </button>
    </div>
  );
}
