// components/bbip/care/CareActions.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { orderText } from "../../../lib/bbip/care/format";
import type { CareOrder } from "../../../lib/bbip/care/types";

const ACTION = "font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink";
const QUIET = "text-ink/70 underline decoration-ink/20 underline-offset-4 hover:text-ink";

export function CareActions({
  order,
  procedures,
  ready,
  busy,
  onSaveSet,
  onRegenerate,
}: {
  order: CareOrder;
  procedures: string[];
  ready: boolean;
  busy: boolean;
  onSaveSet: (procedure: string) => Promise<string | null>;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "manual">("idle");
  const [procedure, setProcedure] = useState(procedures[0] ?? "");
  const [setMessage, setSetMessage] = useState<string | null>(null);
  const text = orderText(order.items);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
    } catch {
      // No clipboard (http, permissions): show the text to copy by hand.
      setCopied("manual");
    }
  }

  async function saveSet() {
    const error = await onSaveSet(procedure);
    setSetMessage(error ?? `‘${procedure}’ 세트로 저장했습니다.`);
  }

  return (
    <div className="mt-9 border-t border-ink/10 pt-5">
      {!ready && <p className="mb-3 text-[14px] text-ink/65">모든 행을 확인하면 복사·안내문·세트 저장이 켜집니다.</p>}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px]">
        <button
          type="button"
          disabled={!ready}
          onClick={() => void copy()}
          className={`${ACTION} disabled:text-ink/30 disabled:no-underline`}
        >
          EMR 오더 복사
        </button>
        {copied === "done" && (
          <span role="status" className="text-[14px] text-[#0f5132]">
            복사했습니다
          </span>
        )}
        {ready ? (
          <Link href={`/care/${order.id}/handout`} target="_blank" className={ACTION}>
            환자 안내문
          </Link>
        ) : (
          <span aria-disabled="true" className="font-semibold text-ink/65">
            환자 안내문
          </span>
        )}
        <span className="flex items-center gap-2">
          {procedures.length > 1 && (
            <select
              aria-label="세트로 저장할 시술"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              className="border-b border-ink/20 bg-transparent py-0.5 text-[15px] text-ink"
            >
              {procedures.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={!ready || !procedure}
            onClick={() => void saveSet()}
            className={`${ACTION} disabled:text-ink/30 disabled:no-underline`}
          >
            내 세트로 저장
          </button>
        </span>
        <button type="button" disabled={busy} onClick={onRegenerate} className={`${QUIET} disabled:text-ink/30`}>
          다시 작성
        </button>
        <Link href="/care-sets" className={QUIET}>
          내 세트 관리
        </Link>
      </div>
      {setMessage && (
        <p role="status" className="mt-3 text-[14px] text-ink/70">
          {setMessage}
        </p>
      )}
      {copied === "manual" && (
        <textarea
          readOnly
          value={text}
          rows={8}
          aria-label="EMR 오더 텍스트"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 block w-full border border-ink/15 p-2 font-mono text-[13px] text-ink"
        />
      )}
    </div>
  );
}
