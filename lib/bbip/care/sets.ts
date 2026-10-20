// lib/bbip/care/sets.ts
import { PRIMARY_FIELD } from "./fields";
import { activeItems } from "./lint";
import type { CareItem, CareSet } from "./types";

function squash(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** "피코 토닝" and "피코토닝" share one set. */
export function procedureKey(label: string): string {
  return squash(label);
}

export function dedupeKey(item: CareItem): string {
  return `${item.kind}:${squash(item.fields[PRIMARY_FIELD[item.kind]] ?? "")}`;
}

/** A row as stored in (or seeded from) a set: fresh id, no session-specific
 * citation, unconfirmed (createCareOrder re-checks it against the case). */
function asSetRow(item: CareItem): CareItem {
  return {
    id: crypto.randomUUID(),
    kind: item.kind,
    fields: { ...item.fields },
    patientText: item.patientText,
    source: "set",
    confirmed: false,
  };
}

/** Rows of every set matching the case, first set winning on duplicates. */
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
