// Core domain vocabulary for New Codex.
// These types are intentionally decoupled from the DB schema (lib/db/schema.ts)
// so the storage layer can change without reshaping the domain model.

export type ContentTier =
  | "procedure_tip"
  | "chairside_talk"
  | "deep_study"
  | "base_medical_knowledge";

export interface ContentTierInfo {
  id: ContentTier;
  labelKo: string;
  labelEn: string;
  descriptionKo: string;
  descriptionEn: string;
}

export type SourceType =
  | "paper"
  | "textbook"
  | "book"
  | "course"
  | "manufacturer_guideline"
  | "personal_note"
  | "website"
  | "other";

export interface CategoryDef {
  /** Stable slug used as the DB id and as the Obsidian folder segment. */
  key: string;
  labelKo: string;
  labelEn: string;
  /** key of the parent category, omitted for top-level categories. */
  parentKey?: string;
  descriptionKo?: string;
  descriptionEn?: string;
}

export type EntryStatus = "draft" | "reviewed";

export interface SourceRef {
  id: string;
  type: SourceType;
  citation: string;
  url?: string;
  authors?: string;
  year?: number;
}

export interface CodexEntry {
  id: string;
  title: string;
  /** Bilingual body. Kept as one Markdown-ish string so Korean and English
   * can be interleaved sentence-by-sentence, per the "don't over-summarize,
   * mix EN+KO for readability" requirement instead of forcing two separate
   * translated blocks. */
  content: string;
  categoryKey: string;
  tier: ContentTier;
  tags: string[];
  sources: SourceRef[];
  /** id of an existing entry this one extends/overlaps with, if any. */
  relatedEntryIds: string[];
  status: EntryStatus;
  createdAt: string;
  updatedAt: string;
}
