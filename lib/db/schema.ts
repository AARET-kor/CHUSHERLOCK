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
