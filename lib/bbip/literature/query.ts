// lib/bbip/literature/query.ts
import { getAnthropicClient, isFakeMode, LIGHT_MODEL } from "../../ai/client";
import { supportsEffort } from "../models";
import { neutralizeTags } from "../prompts";
import type { ParsedCase } from "../types";

export interface LitQuery {
  pubmed: string;
  web: string;
}

export type QueryCaller = (chips: ParsedCase) => Promise<LitQuery>;

const QUERY_TIMEOUT_MS = 8_000;
const PUBMED_MAX = 300;
const WEB_MAX = 150;

/** Korean chip vocabulary → English/MeSH, for the offline fallback. First match wins. */
const TERMS: Array<[RegExp, string]> = [
  [/기미|melasma/i, "Melasma"],
  [/여드름\s*흉터|acne scar/i, "Acne scar"],
  [/여드름|acne/i, "Acne Vulgaris"],
  [/주름|wrinkle/i, "Skin Aging"],
  [/홍조|주사비|rosacea/i, "Rosacea"],
  [/색소|pigment/i, "Hyperpigmentation"],
  [/켈로이드|keloid/i, "Keloid"],
  [/피코|pico/i, "picosecond laser"],
  [/토닝|toning/i, "laser toning"],
  [/필러|filler/i, "Dermal Fillers"],
  [/보톡스|보툴|톡신|botox|botulinum/i, "Botulinum Toxins, Type A"],
  [/실\s*리프팅|thread/i, "thread lift"],
  [/쥬베룩|pdlla/i, "poly-D,L-lactic acid"],
  [/스컬트라|plla/i, "poly-L-lactic acid"],
  [/엘란쎄|polycaprolactone/i, "polycaprolactone"],
  [/리쥬란|pdrn|polynucleotide/i, "polynucleotides"],
  [/스킨\s*부스터|skin ?booster/i, "skin booster"],
  [/울쎄라|슈링크|hifu/i, "High-Intensity Focused Ultrasound"],
  [/써마지|고주파|radiofrequency/i, "Radiofrequency Therapy"],
  [/아스피린|aspirin/i, "Aspirin"],
  [/와파린|warfarin/i, "Warfarin"],
  [/항응고|항혈소판|anticoagul|antiplatelet/i, "Anticoagulants"],
  [/이소트레티노인|로아큐탄|isotretinoin/i, "Isotretinoin"],
  [/임신|pregnan/i, "Pregnancy"],
];

function translate(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    const known = TERMS.find(([pattern]) => pattern.test(item))?.[1];
    const term = known ?? (/^[\x20-\x7e]+$/.test(item) ? item.trim() : "");
    if (term && !out.includes(term)) out.push(term);
  }
  return out;
}

function orGroup(terms: string[]): string {
  const quoted = terms.map((term) => `"${term.replace(/"/g, "")}"`);
  return quoted.length > 1 ? `(${quoted.join(" OR ")})` : (quoted[0] ?? "");
}

export function sanitizeLitQuery(query: LitQuery): LitQuery {
  const clean = (value: string, max: number) =>
    value
      .replace(/[\u0000-\u001f\u007f<>`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  return { pubmed: clean(query.pubmed, PUBMED_MAX), web: clean(query.web, WEB_MAX) };
}

/** Deterministic query (fake mode, model failure): procedure AND
 * (condition, or medication when no condition is known). */
export function fallbackQuery(chips: ParsedCase): LitQuery {
  const procedures = translate(chips.procedures);
  const conditions = translate(chips.conditions);
  const meds = translate(chips.meds);
  const second = conditions.length > 0 ? conditions : meds;
  const pubmed = [orGroup(procedures), orGroup(second)].filter(Boolean).join(" AND ");
  return sanitizeLitQuery({ pubmed, web: [...procedures, ...conditions, ...meds].join(" ") });
}

const QUERY_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  properties: { pubmed: { type: "string" }, web: { type: "string" } },
  required: ["pubmed", "web"],
  additionalProperties: false,
};

/** Patient chips are deliberately left out: they add nothing to a literature
 * search and are the closest thing to identifying information. */
export function buildQueryPrompt(chips: ParsedCase): string {
  const list = (items: string[]) => (items.length ? items.map(neutralizeTags).join(", ") : "-");
  return `Turn this aesthetic-medicine case into literature search queries.

<case>
procedures: ${list(chips.procedures)}
conditions: ${list(chips.conditions)}
medications: ${list(chips.meds)}
</case>

- pubmed: an English PubMed query. Use MeSH terms first ("Term"[MeSH Terms]); add [tiab] free-text synonyms only where no MeSH term fits (e.g. brand-new devices or Korean brand names translated to their generic substance). Combine concepts with AND and synonyms with OR. Focus on efficacy and safety of the procedure for the condition, plus a medication interaction if one matters. Under 250 characters.
- web: a short plain-English web query (under 100 characters) for guidelines or regulatory labels on the same question.`;
}

export const anthropicQueryCaller: QueryCaller = async (chips) => {
  const response = await getAnthropicClient().messages.create(
    {
      model: LIGHT_MODEL,
      max_tokens: 1000,
      output_config: {
        ...(supportsEffort(LIGHT_MODEL) ? { effort: "low" as const } : {}),
        format: { type: "json_schema", schema: QUERY_SCHEMA },
      },
      messages: [{ role: "user", content: buildQueryPrompt(chips) }],
    },
    { timeout: QUERY_TIMEOUT_MS, maxRetries: 0 }
  );
  if (response.stop_reason === "refusal") throw new Error("query refused");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("query returned no text");
  return JSON.parse(block.text) as LitQuery;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("query timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function buildLiteratureQuery(
  chips: ParsedCase,
  caller?: QueryCaller
): Promise<{ query: LitQuery; degraded: boolean }> {
  if (!caller && isFakeMode()) return { query: fallbackQuery(chips), degraded: false };
  try {
    const raw = await withTimeout((caller ?? anthropicQueryCaller)(chips), QUERY_TIMEOUT_MS);
    const query = sanitizeLitQuery({ pubmed: String(raw.pubmed ?? ""), web: String(raw.web ?? "") });
    if (!query.pubmed) throw new Error("empty pubmed query");
    return { query: { pubmed: query.pubmed, web: query.web || fallbackQuery(chips).web }, degraded: false };
  } catch (error) {
    console.warn("[bbip] literature query fallback:", error instanceof Error ? error.message : "unknown");
    return { query: fallbackQuery(chips), degraded: true };
  }
}
