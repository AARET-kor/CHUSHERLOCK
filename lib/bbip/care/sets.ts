// lib/bbip/care/sets.ts
import { CARE_FIELDS, PRIMARY_FIELD } from "./fields";
import { activeItems } from "./lint";
import type { CareItem, CareSet } from "./types";

function squash(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** "피코 토닝" and "피코토닝" share one set. */
export function procedureKey(label: string): string {
  return squash(label);
}

/** Identical rows (every field, ignoring case and spacing) share a key;
 * the same drug in another form, dose or regimen does not. */
export function dedupeKey(item: CareItem): string {
  return `${item.kind}:${CARE_FIELDS[item.kind].map((field) => squash(item.fields[field.key] ?? "")).join("|")}`;
}

/** Rows naming the same thing (drug, material, situation, visit). */
export function primaryKey(item: CareItem): string {
  return `${item.kind}:${squash(item.fields[PRIMARY_FIELD[item.kind]] ?? "")}`;
}

/** Primary names that appear in two or more different active rows, as
 * written in the first such row — the doctor should keep only one. */
export function conflictingPrimaries(items: CareItem[]): string[] {
  const groups = new Map<string, { label: string; rows: Set<string> }>();
  for (const item of activeItems(items)) {
    const key = primaryKey(item);
    const group = groups.get(key) ?? { label: (item.fields[PRIMARY_FIELD[item.kind]] ?? "").trim(), rows: new Set() };
    group.rows.add(dedupeKey(item));
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.rows.size > 1).map((group) => group.label);
}

/** A row as stored in (or seeded from) a set: fresh id, no session-specific
 * citation, unconfirmed (createCareOrder re-checks it against the case). */
function asSetRow(item: CareItem): CareItem {
  return {
    id: crypto.randomUUID(),
    kind: item.kind,
    fields: { ...item.fields },
    patientText: item.patientText,
    ...(item.patientTextBasis !== undefined ? { patientTextBasis: item.patientTextBasis } : {}),
    source: "set",
    confirmed: false,
  };
}

/** Rows of every set matching the case; identical rows appear once. */
export function seedFromSets(sets: CareSet[]): CareItem[] {
  const seen = new Set<string>();
  const rows: CareItem[] = [];
  for (const set of sets) {
    for (const item of set.items) {
      const key = dedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(asSetRow(item));
    }
  }
  return rows;
}

/** Confirmed, active rows of an order as rows for "내 세트로 저장". */
export function toSetItems(items: CareItem[]): CareItem[] {
  return activeItems(items)
    .filter((item) => item.confirmed)
    .map(asSetRow);
}
