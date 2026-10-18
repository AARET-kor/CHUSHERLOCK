"use client";

import { ArrowUp, LoaderCircle, ShieldCheck } from "lucide-react";

export const CASE_INPUT_ID = "bbip-input";

/** One-line case memo, styled for the dark console hero. Controlled so the
 * hero's example buttons can fill it. */
export function CaseInput({
  value,
  onValueChange,
  disabled,
  onSubmit,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  onSubmit: (input: string) => void;
}) {
  function submit() {
    const input = value.trim();
    if (input.length < 2 || disabled) return;
    onSubmit(input);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative rounded-2xl bg-white text-ink shadow-[0_18px_40px_rgba(0,0,0,0.22)] ring-1 ring-white/20 transition focus-within:ring-4 focus-within:ring-[#bfe7d1]/40">
        <label htmlFor={CASE_INPUT_ID} className="sr-only">
          케이스 입력
        </label>
        <textarea
          id={CASE_INPUT_ID}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              // Enter that confirms an IME composition (Korean) must not submit.
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          autoFocus
          placeholder="예: 40대 여성, 기미, 아스피린 복용, 피코토닝 희망"
          className="block w-full resize-none rounded-2xl bg-transparent px-4 pb-14 pt-3.5 text-base leading-relaxed text-ink placeholder:text-ink/45 focus:outline-none"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 pb-3">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink/65 sm:inline">
            Enter 전송 · Shift+Enter 줄바꿈
          </span>
          <button
            type="submit"
            disabled={disabled || value.trim().length < 2}
            className="btn-primary pointer-events-auto ml-auto !px-5 !py-2"
          >
            {disabled ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            )}
            {disabled ? "분석 중…" : "BBIP"}
          </button>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-white/55">
        <ShieldCheck aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
        이름·연락처 등 환자 식별정보는 입력하지 마세요. 입력 원문은 저장되지 않습니다.
      </p>
    </form>
  );
}
