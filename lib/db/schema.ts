import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import type { Flag, LiteratureBlock, ParsedCase } from "../bbip/types";

// Categories are seeded from lib/codex/taxonomy.ts at migrate time, but kept
// as a real table (not just the static list) so future user-added leaf
// categories persist independently of code deploys.
export const categories = sqliteTable("categories", {
  key: text("key").primaryKey(),
  labelKo: text("label_ko").notNull(),
  labelEn: text("label_en").notNull(),
  parentKey: text("parent_key"),
  descriptionKo: text("description_ko"),
  descriptionEn: text("description_en"),
});

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // SourceType
    citation: text("citation").notNull(),
    url: text("url"),
    authors: text("authors"),
    year: integer("year"),
    versionLabel: text("version_label"),
    validUntil: text("valid_until"),
    evidenceLevel: text("evidence_level"),
  },
  (table) => ({
    citationIdx: index("sources_citation_idx").on(table.citation),
  })
);

export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    categoryKey: text("category_key")
      .notNull()
      .references(() => categories.key),
    tier: text("tier").notNull(), // ContentTier
    tags: text("tags", { mode: "json" }).notNull().$type<string[]>(),
    status: text("status").notNull().default("draft"), // EntryStatus
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    exportedAt: text("exported_at"),
    contentVersion: integer("content_version").notNull().default(1),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    reviewDueAt: text("review_due_at"),
  },
  (table) => ({
    categoryIdx: index("entries_category_idx").on(table.categoryKey),
    tierIdx: index("entries_tier_idx").on(table.tier),
    statusIdx: index("entries_status_idx").on(table.status),
    updatedIdx: index("entries_updated_idx").on(table.updatedAt),
  })
);

// Many-to-many: an entry can cite multiple sources, a source can back
// multiple entries.
export const entrySources = sqliteTable(
  "entry_sources",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.entryId, table.sourceId] }),
    sourceIdx: index("entry_sources_source_idx").on(table.sourceId),
  })
);

/** Claim-level provenance: each clinically relevant statement can point to
 * the exact page/section and preserve the source wording separately from
 * the AI's paraphrase. */
export const entryClaims = sqliteTable(
  "entry_claims",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
    claimText: text("claim_text").notNull(),
    representation: text("representation").notNull(), // verbatim | ai_paraphrase | author_note
    originalQuote: text("original_quote"),
    sourceLocation: text("source_location").notNull(),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    section: text("section"),
    evidenceLevel: text("evidence_level").notNull().default("unknown"),
    conflictStatus: text("conflict_status").notNull().default("none"),
    conflictNote: text("conflict_note"),
    conflictsWithClaimId: text("conflicts_with_claim_id"),
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    generatedByModel: text("generated_by_model"),
    promptVersion: text("prompt_version"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    entryIdx: index("entry_claims_entry_idx").on(table.entryId),
    sourceIdx: index("entry_claims_source_idx").on(table.sourceId),
    conflictIdx: index("entry_claims_conflict_idx").on(table.conflictStatus),
  })
);

/** Immutable snapshots written before every edit for clinical auditability. */
export const entryRevisions = sqliteTable(
  "entry_revisions",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull(),
    changedBy: text("changed_by"),
    changeNote: text("change_note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    entryVersionIdx: index("entry_revisions_entry_version_idx").on(
      table.entryId,
      table.version
    ),
  })
);

// One row per AI ingest run: a pasted text or uploaded document being read
// through the classification pipeline. Suggestions are stored as JSON until
// the user reviews and accepts them into real entries.
export const ingestJobs = sqliteTable("ingest_jobs", {
  id: text("id").primaryKey(),
  sourceLabel: text("source_label").notNull(), // filename or "붙여넣은 텍스트"
  sourceCitation: text("source_citation").notNull(),
  sourceType: text("source_type").notNull(), // SourceType
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  totalChunks: integer("total_chunks").notNull().default(0),
  processedChunks: integer("processed_chunks").notNull().default(0),
  suggestions: text("suggestions", { mode: "json" }).$type<unknown[]>(),
  error: text("error"),
  /** Durable input saved under data/ingest-jobs until the job completes.
   * Keeping the input outside process memory makes interrupted work
   * recoverable after a restart or hot reload. */
  payloadPath: text("payload_path"),
  payloadKind: text("payload_kind"), // file | text
  /** Lease/retry metadata for the SQLite-backed worker. */
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  workerId: text("worker_id"),
  heartbeatAt: text("heartbeat_at"),
  leaseUntil: text("lease_until"),
  nextRunAt: text("next_run_at"),
  cancelRequestedAt: text("cancel_requested_at"),
  aiModel: text("ai_model"),
  promptVersion: text("prompt_version"),
  /** Human-readable status of figure/graph extraction for this job: a count
   * summary on success, or the failure reason (so extraction problems are
   * visible instead of silently swallowed). */
  figureNote: text("figure_note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  statusNextRunIdx: index("ingest_jobs_status_next_run_idx").on(table.status, table.nextRunAt),
  leaseIdx: index("ingest_jobs_lease_idx").on(table.leaseUntil),
}));

// Visual material (figures, tables, charts, photos) cropped verbatim from
// source documents. Files live under data/figures/; rows link them to the
// ingest job that produced them and, once saved, to the entry that uses them.
export const figures = sqliteTable(
  "figures",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id"),
    entryId: text("entry_id"),
    filename: text("filename").notNull(), // file name inside the figures dir
    kind: text("kind").notNull(), // figure | table | chart | photo
    caption: text("caption").notNull(),
    page: integer("page"), // 1-based page/slide number in the source
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    entryIdx: index("figures_entry_idx").on(table.entryId),
    jobIdx: index("figures_job_idx").on(table.jobId),
  })
);

// Learning clusters (학습 묶음): AI-curated groups of related notes with a
// study order, a rationale, and follow-up study suggestions — so knowledge
// is consumed in coherent chunks instead of fragments. Rebuilt as a whole
// by the cluster pass; rows are cheap and disposable.
export const clusters = sqliteTable("clusters", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  /** Why these notes belong together / what studying them yields. */
  description: text("description").notNull(),
  /** Follow-up topics worth studying next (연계 학습 제안). */
  suggestions: text("suggestions", { mode: "json" }).notNull().$type<string[]>(),
  /** "ai" (regenerated by the clustering pass) or "manual" (user-created or
   * user-edited — preserved across "다시 묶기" so hand-curated study units
   * are never blown away by a rebuild). */
  origin: text("origin").notNull().default("ai"),
  createdAt: text("created_at").notNull(),
});

export const clusterEntries = sqliteTable(
  "cluster_entries",
  {
    clusterId: text("cluster_id")
      .notNull()
      .references(() => clusters.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    /** Recommended study order within the cluster (0-based). */
    position: integer("position").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clusterId, table.entryId] }),
  })
);

// Spaced-repetition flashcards (Anki-style). Each card is a Q/A pair derived
// from a note, carrying SM-2 scheduling state so it resurfaces at growing
// intervals (daily → weekly → monthly) until it's well learned. The user
// reviews due cards and grades recall; the scheduler (lib/srs/scheduler.ts)
// updates the state.
export const flashcards = sqliteTable("flashcards", {
  id: text("id").primaryKey(),
  /** Source note. Cards are deleted when their note is (cascade). */
  entryId: text("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  front: text("front").notNull(), // question / prompt
  back: text("back").notNull(), // answer
  // --- SM-2 scheduling state ---
  /** learning | review | lapsed — Anki-like lifecycle phase. */
  status: text("status").notNull().default("learning"),
  /** Index into the learning/relearning steps while status != "review". */
  learningStep: integer("learning_step").notNull().default(0),
  /** Ease factor (SM-2 EF), ×1000 as an integer to avoid float drift.
   * 2500 = EF 2.5 (the SM-2 default). Floor 1300. */
  easeMilli: integer("ease_milli").notNull().default(2500),
  /** Current inter-repetition interval in days (review phase). */
  intervalDays: integer("interval_days").notNull().default(0),
  /** Number of successful reviews in a row. */
  reps: integer("reps").notNull().default(0),
  /** Times the card has lapsed (forgotten in review phase). */
  lapses: integer("lapses").notNull().default(0),
  /** When the card is next due (ISO date-time). */
  dueAt: text("due_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastReviewedAt: text("last_reviewed_at"),
}, (table) => ({
  dueIdx: index("flashcards_due_idx").on(table.dueAt),
  entryIdx: index("flashcards_entry_idx").on(table.entryId),
}));

// Self-referencing overlap/relation links, so new material that overlaps an
// existing entry gets linked instead of duplicated (per the "existing vs.
// new content should overlap naturally, not collide" requirement).
export const entryRelations = sqliteTable(
  "entry_relations",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    relatedEntryId: text("related_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.entryId, table.relatedEntryId] }),
    relatedIdx: index("entry_relations_related_idx").on(table.relatedEntryId),
  })
);

// BBIP — one row per chairside case. The raw one-line case memo is never
// persisted. Parsed chips (e.g. demographics like "40대 여성") and any custom
// question text typed in the UI (bbip_turns.question) ARE stored.
export const bbipSessions = sqliteTable(
  "bbip_sessions",
  {
    id: text("id").primaryKey(),
    chips: text("chips", { mode: "json" }).notNull().$type<ParsedCase>(),
    flags: text("flags", { mode: "json" }).notNull().$type<Flag[]>(),
    /** Retrieved once per session, relevance order; index+1 = citation [n]. */
    sourceNoteIds: text("source_note_ids", { mode: "json" }).notNull().$type<string[]>(),
    /** 🔬 literature block (null until searched); [P#]/[W#] index into it. */
    literature: text("literature", { mode: "json" }).$type<LiteratureBlock>(),
    promptVersion: text("prompt_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("bbip_sessions_created_idx").on(table.createdAt),
  })
);

// One generated card per row: the brief, a section, a follow-up, or a
// custom question.
export const bbipTurns = sqliteTable(
  "bbip_turns",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => bbipSessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // TurnKind
    sectionKey: text("section_key"),
    question: text("question"),
    output: text("output").notNull().default(""),
    followups: text("followups", { mode: "json" }).notNull().$type<string[]>(),
    model: text("model").notNull(),
    status: text("status").notNull().default("streaming"), // TurnStatus
    error: text("error"),
    promotedEntryId: text("promoted_entry_id").references(() => entries.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    sessionIdx: index("bbip_turns_session_idx").on(table.sessionId, table.createdAt),
  })
);

// Literature search results keyed by "provider:normalized query". The
// 30-day TTL is enforced on read (lib/bbip/literature/cache.ts).
export const literatureCache = sqliteTable("literature_cache", {
  key: text("key").primaryKey(),
  provider: text("provider").notNull(), // "pubmed" | "web"
  results: text("results", { mode: "json" }).notNull().$type<unknown[]>(),
  fetchedAt: text("fetched_at").notNull(),
});
