// lib/papers/topics.ts
// Which papers we collect and how a consult case maps onto them. Pure.
import type { ParsedCase } from "../bbip/types";
import { classifyProcedure, type MajorKey } from "../records/taxonomy";
import { TOPIC_KEYS, type TopicKey } from "./types";

export interface TopicDef {
  key: TopicKey;
  en: string;
  ko: string;
  /** Colour family, shared with the Records category tags. */
  major: MajorKey;
  query: string;
}

export const TOPICS: Record<TopicKey, TopicDef> = {
  filler: {
    key: "filler",
    en: "Filler",
    ko: "필러",
    major: "filler",
    query:
      '("Dermal Fillers"[Majr] OR filler[ti] OR fillers[ti] OR "dermal filler"[tiab] OR "dermal fillers"[tiab] OR "soft tissue filler"[tiab] OR "soft tissue fillers"[tiab] OR "hyaluronic acid filler"[tiab] OR "hyaluronic acid fillers"[tiab] OR "HA filler"[tiab] OR "HA fillers"[tiab] OR (hyaluronidase[tiab] AND (filler*[tiab] OR "hyaluronic acid"[tiab] OR occlusion[tiab])))',
  },
  thread: {
    key: "thread",
    en: "Thread lift",
    ko: "실리프팅",
    major: "lifting",
    query:
      '("thread lift"[tiab] OR "thread lifting"[tiab] OR threadlift[tiab] OR thread[ti] OR threads[ti] OR (("barbed suture"[tiab] OR "barbed sutures"[tiab]) AND (rhytidectomy[tiab] OR facelift[tiab] OR "face lift"[tiab] OR midface[tiab]))) NOT (abdomen[ti] OR abdominal[ti] OR abdominoplasty[ti] OR liposuction[ti] OR breast[ti] OR buttock[ti] OR gluteal[ti])',
  },
  energy: {
    key: "energy",
    en: "HIFU·RF",
    ko: "에너지 리프팅",
    major: "lifting",
    query:
      '(Ultherapy[tiab] OR "microfocused ultrasound"[tiab] OR "micro-focused ultrasound"[tiab] OR Thermage[tiab] OR (("high-intensity focused ultrasound"[tiab] OR HIFU[tiab] OR radiofrequency[tiab]) AND (lifting[tiab] OR tightening[tiab] OR laxity[tiab] OR rejuvenation[tiab] OR wrinkle*[tiab])))',
  },
  pigment: {
    key: "pigment",
    en: "Pigment laser",
    ko: "색소 레이저",
    major: "laser",
    query:
      '(((melasma[tiab] OR lentigo[tiab] OR lentigines[tiab] OR "nevus of Ota"[tiab] OR "cafe-au-lait"[tiab] OR hyperpigmentation[ti]) AND (laser[tiab] OR lasers[tiab])) OR "laser toning"[tiab] OR (("picosecond laser"[tiab] OR "picosecond lasers"[tiab] OR "Q-switched"[tiab]) AND (pigment*[tiab] OR melasma[tiab] OR lentig*[tiab] OR nevus[tiab])))',
  },
};

export function topicTerm(key: TopicKey, journalTas: string[], fromDate: string): string {
  const journals = journalTas.map((ta) => `"${ta}"[ta]`).join(" OR ");
  return `(${TOPICS[key].query}) AND (${journals}) AND ("${fromDate}"[edat] : "3000"[edat])`;
}

const PIGMENT_CONDITION = /기미|색소|흑자|잡티|오타|melasma|lentig|pigment/i;

/** Topics a consult case touches, in TOPIC_KEYS order. */
export function topicsForCase(chips: Pick<ParsedCase, "procedures" | "conditions">): TopicKey[] {
  const found = new Set<TopicKey>();
  for (const procedure of chips.procedures) {
    const c = classifyProcedure(procedure);
    if (c.major === "filler") found.add("filler");
    if (c.major === "lifting") {
      if (c.mid === "실리프팅" || !c.mid) found.add("thread");
      if (c.mid === "HIFU" || c.mid === "RF" || !c.mid) found.add("energy");
    }
    if (c.major === "laser" && (c.mid === "토닝" || c.mid === "색소·점" || (!c.mid && c.minor === "피코"))) {
      found.add("pigment");
    }
  }
  if (chips.conditions.some((text) => PIGMENT_CONDITION.test(text))) found.add("pigment");
  return TOPIC_KEYS.filter((key) => found.has(key));
}
