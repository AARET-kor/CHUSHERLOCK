// lib/bbip/care/types.ts
// Post-procedure care orders: prescriptions, dressings, "이럴 때는"
// contingencies and follow-ups. Structured rows the doctor confirms one by
// one before anything is copied to the EMR or handed to the patient.

export type CareKind = "rx" | "dressing" | "contingency" | "followup";
export type Urgency = "now" | "followup" | "watch";
/** set = 내 세트, note = 노트 n, literature = P#/W#, ai = model draft, doctor = typed in by hand. */
export type CareSource = "set" | "note" | "literature" | "ai" | "doctor";

export interface CareItem {
  id: string;
  kind: CareKind;
  /** Field values by key (CARE_FIELDS[kind]); "" when unused. */
  fields: Record<string, string>;
  /** Plain words for the patient handout. Doses, frequency, duration and
   * dates come from `fields`, never from here, so an edited field cannot
   * leave a stale number in the handout. */
  patientText: string;
  /** fieldsFingerprint() of the fields patientText was written for. When the
   * fields change after that, the sentence is left out of the handout until
   * the doctor rewrites it. Absent on older rows (treated as current). */
  patientTextBasis?: string;
  source: CareSource;
  /** "2" for note 2, "P1"/"W1" for literature; only with those sources. */
  cite?: string;
  confirmed: boolean;
  /** A saved-set row the model suggested dropping for this case. Excluded
   * from every output until the doctor restores it. */
  removed?: { reason: string };
}

export interface CareOrder {
  id: string;
  sessionId: string;
  items: CareItem[];
  /** procedureKey of each saved set that seeded this order. */
  setKeys: string[];
  /** One case-level caution from the model ("" when none). */
  caution: string;
  /** Notes about the generation itself (rows dropped, adjustment failed). */
  notices: string[];
  /** Model that wrote the draft ("set" when only a saved set was used). */
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareSet {
  id: string;
  procedureKey: string;
  /** The procedure chip as the doctor typed it. */
  label: string;
  items: CareItem[];
  sourceSessionId?: string;
  updatedAt: string;
}
