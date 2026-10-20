// components/bbip/care/HandoutActions.tsx
"use client";

import { useState } from "react";

const ACTION = "font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink";

export function HandoutActions({ text }: { text: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  return (
    <div className="mt-10 flex flex-wrap items-center gap-6 text-[15px] print:hidden">
      <button type="button" onClick={() => window.print()} className={ACTION}>
        인쇄
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied("done");
          } catch {
            setCopied("failed");
          }
        }}
        className={ACTION}
      >
        텍스트 복사 (카톡용)
      </button>
      {copied === "done" && (
        <span role="status" className="text-[14px] text-[#0f5132]">
          복사했습니다
        </span>
      )}
      {copied === "failed" && (
        <span role="status" className="text-[14px] text-red-800">
          복사하지 못했습니다 — 화면을 길게 눌러 복사해 주세요.
        </span>
      )}
    </div>
  );
}
