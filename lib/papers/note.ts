// lib/papers/note.ts
// Reading aids for the paper note: where sentences end and what a skimming
// doctor should catch (lead-ins, doses, intervals, pen marks). Display only:
// it never changes the analysis text, which is what the quotes and briefs rely on.
import type { Pen, PenMark } from "./types";

export interface NotePart {
  text: string;
  strong: boolean;
  pen?: Pen;
}

/** Only Korean sentence endings split, so "et al." and "vs." stay whole. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[다음함됨임요음]\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

const LEAD_IN_MAX = 24;
const UNITS = "%|mg/mL|mg/ml|mg|mL|ml|cc|IU|mm|cm|nm|J/cm²|kHz|MHz|주일|주|개월|일|회|년|명|배";
const NUMBER = "\\d+(?:[.,]\\d+)?";
const MEASURE = new RegExp(
  `n\\s?=\\s?\\d+|(?<![\\d.,])(?!\\d{4}(?:[-–~]\\d{4})?년)(?:[≤≥<>]\\s?)?${NUMBER}(?:\\s?[-–~]\\s?${NUMBER})?\\s?(?:${UNITS})(?![A-Za-z])`,
  "g"
);

function measures(text: string): NotePart[] {
  const parts: NotePart[] = [];
  let at = 0;
  for (const match of text.matchAll(MEASURE)) {
    if (match.index > at) parts.push({ text: text.slice(at, match.index), strong: false });
    parts.push({ text: match[0], strong: true });
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), strong: false });
  return parts;
}

/** Splits text into plain and emphasized runs; joined, they are the input. */
export function emphasize(text: string): NotePart[] {
  const colon = text.indexOf(": ");
  if (colon > 0 && colon < LEAD_IN_MAX) {
    return [{ text: text.slice(0, colon + 1), strong: true }, ...measures(text.slice(colon + 1))];
  }
  return measures(text);
}

/** Lays pen marks over the emphasized runs; joined, they are still the input.
 * Longer phrases win when two marks overlap. */
export function noteParts(text: string, marks: PenMark[] = []): NotePart[] {
  const ranges: Array<{ start: number; end: number; pen: Pen }> = [];
  for (const mark of [...marks].sort((a, b) => b.text.length - a.text.length)) {
    const start = text.indexOf(mark.text);
    if (start < 0) continue;
    const end = start + mark.text.length;
    if (ranges.some((r) => start < r.end && r.start < end)) continue;
    ranges.push({ start, end, pen: mark.pen });
  }
  const parts: NotePart[] = [];
  let at = 0;
  for (const base of emphasize(text)) {
    const baseEnd = at + base.text.length;
    const inside = ranges.flatMap((r) => [r.start, r.end]).filter((cut) => cut > at && cut < baseEnd);
    const cuts = [at, ...inside, baseEnd].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const [from, to] = [cuts[i]!, cuts[i + 1]!];
      if (from === to) continue;
      const pen = ranges.find((r) => from >= r.start && to <= r.end)?.pen;
      parts.push({ text: text.slice(from, to), strong: base.strong, ...(pen ? { pen } : {}) });
    }
    at = baseEnd;
  }
  return parts;
}
