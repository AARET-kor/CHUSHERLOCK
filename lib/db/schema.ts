import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

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

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // SourceType
  citation: text("citation").notNull(),
  url: text("url"),
  authors: text("authors"),
  year: integer("year"),
});

export const entries = sqliteTable("entries", {
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
});

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
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Visual material (figures, tables, charts, photos) cropped verbatim from
// source documents. Files live under data/figures/; rows link them to the
// ingest job that produced them and, once saved, to the entry that uses them.
export const figures = sqliteTable("figures", {
  id: text("id").primaryKey(),
  jobId: text("job_id"),
  entryId: text("entry_id"),
  filename: text("filename").notNull(), // file name inside the figures dir
  kind: text("kind").notNull(), // figure | table | chart | photo
  caption: text("caption").notNull(),
  page: integer("page"), // 1-based page/slide number in the source
  createdAt: text("created_at").notNull(),
});

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
  })
);
