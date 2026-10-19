import { getStructure } from "./atlas";

// Model output names atlas structures as {{atlas:<id>}}. Known ids become
// chips that focus the structure on the map; unknown ids fall back to their
// plain text, so a made-up id never looks like a curated structure.

export const ATLAS_TOKEN = /\{\{atlas:([a-z0-9-]{1,60})\}\}/g;
export const ATLAS_TOKEN_START = /^\{\{atlas:([a-z0-9-]{1,60})\}\}/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Known atlas ids mentioned in the text, first-seen order, unique. */
export function atlasTokenIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(ATLAS_TOKEN)) {
    if (getStructure(match[1]!)) ids.add(match[1]!);
  }
  return [...ids];
}

/** Plain-text form for saved notes: "각동맥(angular a.)". */
export function atlasTokensToText(text: string): string {
  return text.replace(ATLAS_TOKEN, (_raw, id: string) => {
    const s = getStructure(id);
    return s ? `${s.ko}(${s.en})` : id;
  });
}

export function atlasChipHtml(id: string): string {
  const s = getStructure(id);
  if (!s) return escapeHtml(id);
  return `<button type="button" class="ev ev-atlas" data-atlas="${escapeHtml(id)}" title="${escapeHtml(
    `${s.en} — 해부 지도에서 보기`
  )}">🧭 ${escapeHtml(s.ko)}</button>`;
}
