"use client";

import { useLayoutEffect, useRef } from "react";

export const CASE_INPUT_ID = "bbip-input";

/** The case line: one large serif line on a hairline, no box. Grows with
 * the text. Controlled so example cases can fill it. */
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
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

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
      <label htmlFor={CASE_INPUT_ID} className="sr-only">
        케이스 입력
      </label>
      <div className="flex items-end gap-4 sm:gap-6">
        <textarea
          ref={ref}
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
          rows={1}
          autoFocus
          placeholder="40대 여성, 기미, 아스피린 복용, 피코토닝 희망"
          className="bbip-line block resize-none overflow-hidden pb-3 font-serifa text-[24px] leading-[1.45] text-ink sm:text-[28.5px]"
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length < 2}
          aria-busy={disabled}
          data-busy={disabled ? "true" : undefined}
          className={`bbip-go mb-2 inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full px-5 text-[15px] font-semibold tracking-wide text-white transition duration-200 active:scale-[0.96] ${
            disabled
              ? "cursor-progress bg-ink"
              : "bg-ink hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(5,26,36,0.22)] disabled:translate-y-0 disabled:bg-ink/25 disabled:shadow-none"
          }`}
        >
          {disabled ? "분석 중" : "BBIP"}
          <GoMark />
        </button>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink/65">
        <span>Enter 보내기 · Shift+Enter 줄바꿈</span>
        <span>이름·연락처는 쓰지 마세요 — 원문은 저장되지 않습니다</span>
      </p>
    </form>
  );
}

// The brand ∞ as a monoline icon: the needle slides through on hover, and
// while a case is being read a light segment runs the loop (globals.css).
const INFINITY =
  "M20 10C23 6 27 4 31 4C35 4 38 7 38 10C38 13 35 16 31 16C27 16 23 14 20 10C17 6 13 4 9 4C5 4 2 7 2 10C2 13 5 16 9 16C13 16 17 14 20 10Z";

function GoMark() {
  return (
    <svg viewBox="0 0 40 20" aria-hidden="true" className="h-[15px] w-[30px] overflow-visible">
      <g transform="rotate(-8 20 10)" fill="none" stroke="currentColor" strokeLinecap="round">
        <path className="go-inf" d={INFINITY} pathLength={100} strokeWidth={2.4} />
        <path className="go-trace" d={INFINITY} pathLength={100} strokeWidth={2.8} />
        <path className="go-needle" d="M-3 14.5L43 5.5" pathLength={100} strokeWidth={1.3} />
      </g>
    </svg>
  );
}
