// lib/bbip/care/format.ts
import { CARE_KINDS, KIND_LABEL, URGENCY_LABEL } from "./fields";
import { activeItems } from "./lint";
import type { CareItem, Urgency } from "./types";

// Both outputs are built deterministically from the confirmed fields, so
// what the patient reads always matches what was ordered.

export const HANDOUT_FOOTER = "궁금한 점이나 이상 증상이 있으면 병원으로 연락해 주세요.";

const URGENCY_PATIENT: Record<Urgency, string> = {
  now: "바로 병원으로 연락하세요.",
  followup: "다음 내원 때 말씀해 주세요.",
  watch: "대부분 저절로 좋아집니다. 지켜보셔도 됩니다.",
};

function join(parts: Array<string | undefined>, separator: string): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(separator);
}

/** One EMR line for a row (also the row summary in the console). */
export function orderLine(item: CareItem): string {
  const f = item.fields;
  switch (item.kind) {
    case "rx": {
      const name = join([f.drug, f.brand?.trim() ? `(${f.brand.trim()})` : "", f.form], " ");
      const line = join([name, f.dose, f.frequency, f.duration], " · ");
      return f.purpose?.trim() ? `${line} — ${f.purpose.trim()}` : line;
    }
    case "dressing":
      return join([f.material, f.method, f.interval, f.duration], " · ");
    case "contingency": {
      const urgency = URGENCY_LABEL[f.urgency as Urgency] ?? f.urgency ?? "";
      return `${join([f.situation, f.signs], " — ")} → ${join([f.action, f.resolution], " · ")}${urgency ? ` [${urgency}]` : ""}`;
    }
    case "followup":
      return join([f.when, f.checks, f.next], " · ");
  }
}

export function orderText(items: CareItem[]): string {
  const active = activeItems(items);
  return CARE_KINDS.flatMap((kind) => {
    const rows = active.filter((item) => item.kind === kind);
    if (rows.length === 0) return [];
    const lines = rows.map((item, i) => `${kind === "rx" ? `${i + 1}.` : "-"} ${orderLine(item)}`);
    return [`[${KIND_LABEL[kind]}]`, ...lines, ""];
  })
    .join("\n")
    .trim();
}

/** The Seoul calendar day of an instant, as a UTC-midnight Date. */
export function seoulDay(instant: string | Date): Date {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(instant))
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function visitDate(base: Date, days: number): string {
  const date = new Date(base.getTime() + days * 86_400_000);
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일(${WEEKDAYS[date.getUTCDay()]})`;
}

export interface HandoutSection {
  title: string;
  lines: string[];
}

function sentence(head: string, patientText: string): string {
  return patientText.trim() ? `${head} ${patientText.trim()}` : head;
}

function handoutLine(item: CareItem, base: Date): string {
  const f = item.fields;
  switch (item.kind) {
    case "rx": {
      const name = f.brand?.trim() || f.drug?.trim() || "";
      const head = `${f.form?.trim() ? `${name}(${f.form.trim()})` : name}: ${join([f.dose, f.frequency, f.duration], ", ")}.`;
      return sentence(head, item.patientText);
    }
    case "dressing":
      return sentence(`${f.material?.trim()} — ${join([f.method, f.interval, f.duration], ", ")}.`, item.patientText);
    case "contingency": {
      const what = item.patientText.trim() || join([f.situation, f.action], ": ");
      return `${what} → ${URGENCY_PATIENT[f.urgency as Urgency] ?? ""}`.trim();
    }
    case "followup": {
      const day = /^\d{1,3}$/.test(f.day ?? "") ? visitDate(base, Number(f.day)) : (f.when ?? "").trim();
      return `${day} — ${item.patientText.trim() || (f.checks ?? "").trim()}`;
    }
  }
}

const HANDOUT_TITLES: Record<CareItem["kind"], string> = {
  rx: "드실 약·바르실 약",
  dressing: "상처 관리",
  contingency: "이럴 땐 이렇게 하세요",
  followup: "다음 내원",
};

/** Patient-facing sections from the active rows; `base` is the procedure day. */
export function handoutSections(items: CareItem[], base: Date): HandoutSection[] {
  const active = activeItems(items);
  return CARE_KINDS.flatMap((kind) => {
    const lines = active.filter((item) => item.kind === kind).map((item) => handoutLine(item, base));
    return lines.length ? [{ title: HANDOUT_TITLES[kind], lines }] : [];
  });
}

export function handoutText(sections: HandoutSection[]): string {
  return [
    "시술 후 안내",
    "",
    ...sections.flatMap((section) => [`■ ${section.title}`, ...section.lines.map((line) => `- ${line}`), ""]),
    HANDOUT_FOOTER,
  ].join("\n");
}
