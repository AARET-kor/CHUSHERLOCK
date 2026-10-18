"use client";

import { useState } from "react";

export function ClaimReviewControls({
  claimId,
  initialConflictStatus,
  initialConflictNote,
  initiallyVerified,
}: {
  claimId: string;
  initialConflictStatus: "none" | "possible" | "confirmed";
  initialConflictNote?: string;
  initiallyVerified: boolean;
}) {
  const [status, setStatus] = useState(initialConflictStatus);
  const [note, setNote] = useState(initialConflictNote ?? "");
  const [reviewer, setReviewer] = useState("사용자");
  const [verified, setVerified] = useState(initiallyVerified);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const response = await fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conflictStatus: status,
        conflictNote: note || undefined,
        reviewer,
        verified,
      }),
    });
    setSaved(response.ok);
  }

  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-ink/45 hover:text-ink">claim 검토·상충 표시</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_1fr_8rem_auto]">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="field !px-2 !py-1 text-xs"
          aria-label="상충 상태"
        >
          <option value="none">상충 없음</option>
          <option value="possible">상충 가능</option>
          <option value="confirmed">상충 확인</option>
        </select>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="field !px-2 !py-1 text-xs"
          placeholder="상충하는 권고·수치 또는 검토 메모"
          aria-label="상충 검토 메모"
        />
        <input
          value={reviewer}
          onChange={(event) => setReviewer(event.target.value)}
          className="field !px-2 !py-1 text-xs"
          placeholder="검토자"
          aria-label="claim 검토자"
        />
        <button type="button" onClick={save} className="btn-secondary !px-2 !py-1 text-xs">
          {saved ? "저장됨" : "저장"}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-ink/60">
        <input
          type="checkbox"
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        원문과 대조해 검증 완료
      </label>
    </details>
  );
}
