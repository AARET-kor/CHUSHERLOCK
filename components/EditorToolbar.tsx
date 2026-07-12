"use client";

import { useState } from "react";
import {
  HIGHLIGHT_COLORS,
  PEN_COLORS,
  wrapHighlight,
  wrapPen,
  type HighlightColor,
  type PenColor,
} from "../lib/codex/decorations";

const SYMBOLS = [
  "✓", "✗", "★", "●", "○", "■", "□", "▲", "→", "⇒", "↔", "↑", "↓",
  "±", "×", "≈", "≠", "≤", "≥", "°", "℃", "µ", "Δ", "½", "¼",
  "※", "∴", "‣", "·", "⚠️", "✅", "❌", "💉", "📌", "❗", "❓",
];

export interface ToolbarTarget {
  /** Ref to the textarea being decorated — read at click time, so the
   * toolbar works even when it rendered before the textarea mounted. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

/** Formatting toolbar for note editing: 형광펜 5색, 볼펜 5색, 기호 팔레트.
 * Wraps the current selection (or inserts at the cursor) using the
 * decoration syntax that every renderer/export understands. */
export function EditorToolbar({ target }: { target: ToolbarTarget }) {
  const [showSymbols, setShowSymbols] = useState(false);

  function applyToSelection(transform: (selected: string) => string, fallback: string) {
    const el = target.textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = target.value.slice(start, end);
    const inserted = selected ? transform(selected) : fallback;
    const next = target.value.slice(0, start) + inserted + target.value.slice(end);
    target.onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function insertSymbol(symbol: string) {
    applyToSelection((s) => s + symbol, symbol);
  }

  return (
    <div className="rounded-xl border border-ink/10 bg-mist/50 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="mr-0.5 text-[10px] font-medium tracking-wide text-ink/40">형광펜</span>
          {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
            <button
              key={color}
              type="button"
              title={`형광펜 — ${color}`}
              onClick={() =>
                applyToSelection((s) => wrapHighlight(s, color), wrapHighlight("텍스트", color))
              }
              className="h-6 w-6 rounded-md border border-ink/10 transition-transform hover:scale-125 active:scale-95"
              style={{ background: HIGHLIGHT_COLORS[color] }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-0.5 text-[10px] font-medium tracking-wide text-ink/40">볼펜</span>
          {(Object.keys(PEN_COLORS) as PenColor[]).map((color) => (
            <button
              key={color}
              type="button"
              title={`볼펜 — ${color}`}
              onClick={() => applyToSelection((s) => wrapPen(s, color), wrapPen("텍스트", color))}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-ink/10 bg-white text-xs font-bold transition-transform hover:scale-125 active:scale-95"
              style={{ color: PEN_COLORS[color] }}
            >
              가
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSymbols(!showSymbols)}
            className={`rounded-md border border-ink/10 px-2.5 py-1 text-xs transition-colors ${
              showSymbols ? "bg-ink text-white" : "bg-white text-ink/70 hover:bg-mist"
            }`}
          >
            Ω 기호
          </button>
          {showSymbols && (
            <div className="animate-pop-in absolute left-0 top-8 z-30 grid w-64 grid-cols-9 gap-0.5 rounded-xl border border-ink/10 bg-white p-2 shadow-xl">
              {SYMBOLS.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => insertSymbol(symbol)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-all hover:scale-125 hover:bg-mist"
                >
                  {symbol}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="ml-auto hidden text-[10px] text-ink/35 sm:block">
          텍스트를 드래그로 선택한 뒤 색을 누르세요
        </span>
      </div>
    </div>
  );
}
