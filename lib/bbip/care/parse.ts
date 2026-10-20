// lib/bbip/care/parse.ts
import type { LiteratureBlock } from "../types";
import { CareGenerationError } from "./errors";
import { CARE_KINDS, fieldsFingerprint, PRIMARY_FIELD, pickFields } from "./fields";
import type { CareItem, CareKind, CareSource } from "./types";

const MAX_ITEMS = 60;
const DEFAULT_REASON = "이 케이스에 맞지 않음";

export interface CiteContext {
  notes: Array<{ n: number; verified: boolean }>;
  literature?: LiteratureBlock;
}

export interface ParsedCare {
  caution: string;
  items: CareItem[];
  /** Set row id → reason, for rows the model wants dropped. */
  removals: Map<string, string>;
  dropped: number;
}

/** Only citations that exist in this session count; anything else is AI. */
export function resolveCite(cite: string, ctx: CiteContext): { source: CareSource; cite?: string } {
  const value = cite.trim().toUpperCase();
  if (/^\d{1,2}$/.test(value)) {
    const note = ctx.notes.find((n) => n.n === Number(value));
    return note?.verified ? { source: "note", cite: String(note.n) } : { source: "ai" };
  }
  const literature = /^([PW])(\d{1,2})$/.exec(value);
  if (literature) {
    const list = literature[1] === "P" ? ctx.literature?.papers : ctx.literature?.web;
    return list?.[Number(literature[2]) - 1] ? { source: "literature", cite: value } : { source: "ai" };
  }
  return { source: "ai" };
}

export function parseCareResponse(text: string, ctx: CiteContext & { setIds: Set<string> }): ParsedCare {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CareGenerationError("오더 응답을 읽지 못했습니다.");
  }
  const root = (data ?? {}) as { caution?: unknown; items?: unknown; remove?: unknown };
  const items: CareItem[] = [];
  let dropped = 0;
  for (const raw of Array.isArray(root.items) ? root.items : []) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const kind = row.kind as CareKind;
    if (!CARE_KINDS.includes(kind)) {
      dropped++;
      continue;
    }
    const day = typeof row.day === "number" && Number.isInteger(row.day) && row.day > 0 && row.day < 1000 ? String(row.day) : "";
    const fields = pickFields(kind, { ...row, day });
    if (!fields[PRIMARY_FIELD[kind]]) {
      dropped++;
      continue;
    }
    items.push({
      id: crypto.randomUUID(),
      kind,
      fields,
      patientText: typeof row.patientText === "string" ? row.patientText.trim().slice(0, 300) : "",
      patientTextBasis: fieldsFingerprint(kind, fields),
      ...resolveCite(typeof row.cite === "string" ? row.cite : "", ctx),
      confirmed: false,
    });
  }
  const removals = new Map<string, string>();
  for (const raw of Array.isArray(root.remove) ? root.remove : []) {
    const row = (raw ?? {}) as { id?: unknown; reason?: unknown };
    if (typeof row.id !== "string" || !ctx.setIds.has(row.id) || removals.has(row.id)) continue;
    const reason = typeof row.reason === "string" ? row.reason.trim().slice(0, 200) : "";
    removals.set(row.id, reason || DEFAULT_REASON);
  }
  return {
    caution: typeof root.caution === "string" ? root.caution.trim().slice(0, 300) : "",
    items: items.slice(0, MAX_ITEMS),
    removals,
    dropped,
  };
}
