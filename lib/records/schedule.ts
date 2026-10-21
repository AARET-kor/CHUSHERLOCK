// lib/records/schedule.ts
import { seoulDay } from "../bbip/care/format";
import { activeItems } from "../bbip/care/lint";
import type { CareItem } from "../bbip/care/types";
import type { FuStatus, Visit } from "./types";

/** Today on the Seoul calendar, YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return seoulDay(now).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function fuStatus(date: string, today: string): FuStatus {
  if (date < today) return "overdue";
  if (date === today) return "today";
  return date <= addDays(today, 7) ? "week" : "later";
}

export function nextSessionNo(visits: Array<Pick<Visit, "kind" | "sessionNo">>): number {
  const numbers = visits.filter((v) => v.kind === "session" && v.sessionNo !== null).map((v) => v.sessionNo!);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

/** The care order's first active F/U row with a day count, from `base`. */
export function nextFuFromCare(items: CareItem[], base: string): string | null {
  for (const item of activeItems(items)) {
    if (item.kind !== "followup") continue;
    const day = Number(item.fields.day);
    if (Number.isInteger(day) && day > 0) return addDays(base, day);
  }
  return null;
}
