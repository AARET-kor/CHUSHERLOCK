"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
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
          className="mb-2 inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold tracking-wide text-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(5,26,36,0.22)] disabled:translate-y-0 disabled:bg-ink/25 disabled:shadow-none"
        >
          {disabled ? "분석 중…" : "BBIP"}
          {disabled ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink/65">
        <span>Enter 보내기 · Shift+Enter 줄바꿈</span>
        <span>이름·연락처는 쓰지 마세요 — 원문은 저장되지 않습니다</span>
      </p>
    </form>
  );
}
