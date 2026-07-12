// Note decoration syntax — hand-annotation on top of Markdown:
//
//   ==yellow:형광펜 텍스트==     highlight (형광펜), 5 colors
//   ++red:볼펜 텍스트++          pen color (볼펜),   5 colors
//
// The markers survive HTML-escaping and Markdown parsing untouched, so the
// renderers convert them AFTER marked runs. Two output modes:
//  - "class":  <mark class="hl-yellow"> — app UI (animated sweep via CSS)
//  - "inline": <mark style="background:#FEF08A"> — Word/HTML/Obsidian
//    exports, where stylesheets don't travel with the file.

export const HIGHLIGHT_COLORS = {
  yellow: "#FEF08A",
  green: "#BBF7D0",
  pink: "#FBCFE8",
  blue: "#BFDBFE",
  orange: "#FED7AA",
} as const;

export const PEN_COLORS = {
  red: "#DC2626",
  blue: "#2563EB",
  emerald: "#059669",
  violet: "#7C3AED",
  amber: "#D97706",
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;
export type PenColor = keyof typeof PEN_COLORS;

const HL_PATTERN = new RegExp(
  `==(${Object.keys(HIGHLIGHT_COLORS).join("|")}):((?:(?!==)[\\s\\S])+?)==`,
  "g"
);
const PEN_PATTERN = new RegExp(
  `\\+\\+(${Object.keys(PEN_COLORS).join("|")}):((?:(?!\\+\\+)[\\s\\S])+?)\\+\\+`,
  "g"
);

/** Convert decoration markers inside already-rendered HTML. */
export function applyDecorations(html: string, mode: "class" | "inline"): string {
  return html
    .replace(HL_PATTERN, (_m, color: HighlightColor, text: string) =>
      mode === "class"
        ? `<mark class="hl hl-${color}">${text}</mark>`
        : `<mark style="background:${HIGHLIGHT_COLORS[color]};padding:0 2px;border-radius:2px;">${text}</mark>`
    )
    .replace(PEN_PATTERN, (_m, color: PenColor, text: string) =>
      mode === "class"
        ? `<span class="pen pen-${color}">${text}</span>`
        : `<span style="color:${PEN_COLORS[color]};font-weight:600;">${text}</span>`
    );
}

/** Remove decoration markers for plain-text previews. */
export function stripDecorations(text: string): string {
  return text
    .replace(HL_PATTERN, (_m, _c, inner: string) => inner)
    .replace(PEN_PATTERN, (_m, _c, inner: string) => inner);
}

/** Wrap `text` in a decoration marker — used by the editor toolbar. */
export function wrapHighlight(text: string, color: HighlightColor): string {
  return `==${color}:${text}==`;
}

export function wrapPen(text: string, color: PenColor): string {
  return `++${color}:${text}++`;
}
