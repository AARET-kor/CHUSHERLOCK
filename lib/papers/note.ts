// lib/papers/note.ts
// Reading aids for the paper note: where sentences end and what a skimming
// doctor should catch (lead-ins, doses, intervals). Display only: it never
// changes the analysis text, which is what the quotes and briefs rely on.

export interface NotePart {
  text: string;
  strong: boolean;
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
