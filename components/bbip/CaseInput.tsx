"use client";

import { useState } from "react";

export function CaseInput({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (input: string) => void;
}) {
  const [value, setValue] = useState("");

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
      <div className="relative">
        <label htmlFor="bbip-input" className="sr-only">
          케이스 입력
        </label>
        <textarea
          id="bbip-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              // Enter that confirms an IME composition (Korean) must not submit.
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          autoFocus
          placeholder="예: 40대 여성, 기미, 아스피린 복용, 피코토닝 희망"
          className="field resize-none pr-28 text-base leading-relaxed"
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length < 2}
          className="btn-primary absolute bottom-3 right-3 !px-5 !py-2"
        >
          {disabled ? "분석 중…" : "BBIP"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink/60">
        이름·연락처 등 환자 식별정보는 입력하지 마세요. 입력 원문은 저장되지 않습니다.
      </p>
    </form>
  );
}
