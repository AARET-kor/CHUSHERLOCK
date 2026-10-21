// lib/records/chart.ts
// "#20431" in the case line names the patient. It is taken out before the
// memo is sanitized and parsed, so it never lands in chips, turns or prompts.

const CHART = /(^|[\s,])#((?=[A-Za-z-]*\d)[A-Za-z0-9-]{3,12})(?=$|[\s,])/;

export function normalizeChartNo(value: string): string {
  return value.trim().replace(/^#/, "").toUpperCase();
}

export function extractChartNo(input: string): { chartNo: string | null; rest: string } {
  const match = CHART.exec(input);
  if (!match) return { chartNo: null, rest: input };
  const start = match.index + match[1]!.length;
  const end = match.index + match[0].length;
  const rest = `${input.slice(0, start)} ${input.slice(end)}`
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
  return { chartNo: normalizeChartNo(match[2]!), rest };
}
