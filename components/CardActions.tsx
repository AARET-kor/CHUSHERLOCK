"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Note-page flashcard control: make cards from this note (or regenerate),
 * and jump to the review session. */
export function CardActions({ entryId, initialCount }: { entryId: string; initialCount: number }) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function generate(regenerate: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "카드 생성에 실패했습니다.");
        return;
      }
      const created = data.created ?? 0;
      setCount((c) => (regenerate ? created : c + created));
      setMsg(
        created > 0
          ? `플래시카드 ${created}장을 만들었습니다.`
          : regenerate
            ? "이 노트에서 카드를 만들지 못했습니다."
            : "이미 카드가 있습니다."
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {count > 0 ? (
        <>
          <span className="rounded-full bg-mist px-3 py-1.5 text-xs text-ink/60">
            🎴 카드 {count}장
          </span>
          <Link href="/review" className="btn-secondary !px-4 !py-2">
            복습하기
          </Link>
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={busy}
            className="rounded border border-ink/15 px-3 py-2 text-sm text-ink/60 hover:border-ink/30 disabled:opacity-50"
          >
            {busy ? "생성 중…" : "카드 다시 만들기"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => generate(false)}
          disabled={busy}
          className="btn-secondary !px-4 !py-2"
        >
          {busy ? "카드 만드는 중…" : "🎴 카드 만들기"}
        </button>
      )}
      {msg && <span className="text-xs text-ink/50">{msg}</span>}
    </div>
  );
}
