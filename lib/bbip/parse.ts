import { getAnthropicClient, isFakeMode, LIGHT_MODEL } from "../ai/client";
import { mergeFlags, ruleFlags } from "./flags";
import { supportsEffort } from "./models";
import type { Flag, FlagLevel, ParsedCase } from "./types";

export interface ParseResult {
  chips: ParsedCase;
  flags: Flag[];
  /** true when the model call failed and the keyword fallback was used. */
  degraded: boolean;
}

export type ParseCaller = (input: string) => Promise<{
  chips: ParsedCase;
  flags: Array<{ level: FlagLevel; text: string }>;
}>;

const PARSE_TIMEOUT_MS = 8_000;
const MAX_CHIPS = 8;
const MAX_CHIP_CHARS = 40;

const PROCEDURE_HINT =
  /필러|보톡스|톡신|보툴|리프팅|토닝|레이저|부스터|쥬베룩|리쥬란|울쎄라|슈링크|써마지|인모드|올리지오|피코|ipl|co2|프락셀|스킨|주사|시술|제모|박피|필링|엘란쎄|스컬트라/i;
const MED_HINT =
  /복용|약$|mg|캡슐|아스피린|와파린|이소트레티노인|로아큐탄|피임|스테로이드|항생제|aspirin|warfarin|isotretinoin/i;
const PATIENT_HINT =
  /\d+\s*대|\d+\s*세|남성|여성|^남$|^여$|남자|여자|피부\s*타입|fitzpatrick|지성|건성|민감성|흡연|임신|수유/i;

/** Drops Korean mobile numbers and resident registration numbers before
 * the memo goes anywhere, and bounds its length. */
export function sanitizeInput(input: string): string {
  return input
    .replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, "")
    .replace(/\d{6}[-\s]?[1-4]\d{6}/g, "")
    .slice(0, 500)
    .trim();
}

function normalize(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim().slice(0, MAX_CHIP_CHARS);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out.slice(0, MAX_CHIPS);
}

export function normalizeChips(chips: ParsedCase): ParsedCase {
  return {
    patient: normalize(chips.patient),
    conditions: normalize(chips.conditions),
    meds: normalize(chips.meds),
    procedures: normalize(chips.procedures),
  };
}

export function fallbackParse(input: string): ParsedCase {
  const chips: ParsedCase = { patient: [], conditions: [], meds: [], procedures: [] };
  const parts = sanitizeInput(input)
    .split(/[,，、/·\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (PROCEDURE_HINT.test(part)) chips.procedures.push(part.replace(/\s*희망$/, ""));
    else if (MED_HINT.test(part)) chips.meds.push(part.replace(/\s*복용(\s*중)?$/, ""));
    else if (PATIENT_HINT.test(part)) chips.patient.push(part);
    else chips.conditions.push(part);
  }
  return normalizeChips(chips);
}

const PARSE_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  properties: {
    patient: { type: "array", items: { type: "string" } },
    conditions: { type: "array", items: { type: "string" } },
    meds: { type: "array", items: { type: "string" } },
    procedures: { type: "array", items: { type: "string" } },
    flags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["contraindication", "caution"] },
          text: { type: "string" },
        },
        required: ["level", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["patient", "conditions", "meds", "procedures", "flags"],
  additionalProperties: false,
};

export function buildParsePrompt(input: string): string {
  return `미용의학 진료 중 의사가 입력한 한 줄 메모를 구조화하세요.

- patient: 나이대·성별·피부타입·생활습관 등 환자 특징 (짧은 명사구)
- conditions: 주소·질환·피부 고민·기저질환
- meds: 복용 중인 약 (약 이름만)
- procedures: 희망하거나 계획된 시술 (시술명만)
- flags: 이 조합에서 시술 전에 반드시 짚어야 할 금기(contraindication) 또는 주의(caution). 근거가 분명한 것만, 각 한 줄. 없으면 빈 배열.

이름·연락처·주민번호 같은 식별정보는 어떤 필드에도 넣지 마세요. 메모에 없는 사실을 추가하지 마세요.

<memo>
${input}
</memo>`;
}

export const anthropicParseCaller: ParseCaller = async (input) => {
  const response = await getAnthropicClient().messages.create({
    model: LIGHT_MODEL,
    max_tokens: 2000,
    output_config: {
      ...(supportsEffort(LIGHT_MODEL) ? { effort: "low" as const } : {}),
      format: { type: "json_schema", schema: PARSE_SCHEMA },
    },
    messages: [{ role: "user", content: buildParsePrompt(input) }],
  });
  if (response.stop_reason === "refusal") throw new Error("parse refused");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("parse returned no text");
  const { flags, ...chips } = JSON.parse(block.text) as ParsedCase & {
    flags: Array<{ level: FlagLevel; text: string }>;
  };
  return { chips, flags };
};

export const fakeParseCaller: ParseCaller = async (input) => ({
  chips: fallbackParse(input),
  flags: [],
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("parse timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function parseCase(input: string, caller?: ParseCaller): Promise<ParseResult> {
  const clean = sanitizeInput(input);
  const call = caller ?? (isFakeMode() ? fakeParseCaller : anthropicParseCaller);
  try {
    const result = await withTimeout(call(clean), PARSE_TIMEOUT_MS);
    const chips = normalizeChips(result.chips);
    const modelFlags: Flag[] = result.flags.map((f) => ({ ...f, source: "model" }));
    return { chips, flags: mergeFlags(ruleFlags(chips, clean), modelFlags), degraded: false };
  } catch {
    const chips = fallbackParse(clean);
    return { chips, flags: mergeFlags(ruleFlags(chips, clean), []), degraded: true };
  }
}
