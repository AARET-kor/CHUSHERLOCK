import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { figures } from "../db/schema";
import { FIGURES_DIR } from "../ingest/figures";
import { getLeafCategories } from "../codex/taxonomy";
import { contentTierSchema, sourceInputSchema } from "../schemas/entrySchemas";
import { createEntry, attachFiguresToEntry, getEntry } from "../services/entryService";
import type { CodexEntry } from "../codex/types";

// .cognote — Cognitio's note-sharing format. A single self-contained JSON
// file: note bodies keep their Markdown + decoration markers verbatim, and
// every cropped figure travels inside as base64, so the receiver gets the
// note exactly as the sender sees it — colors, tables, images and all.

export const COGNOTE_VERSION = 1;

const cognoteFigureSchema = z.object({
  /** The sender's figure id — referenced by /api/figures/{oldId} URLs
   * inside the note content; rewritten to a fresh id on import. */
  oldId: z.string().min(1),
  kind: z.string().min(1),
  caption: z.string(),
  page: z.number().int().nullable().optional(),
  /** File extension incl. dot, whitelisted so imports can't write
   * arbitrary paths or executable files. */
  ext: z.enum([".png", ".jpg", ".jpeg", ".gif", ".webp"]),
  dataBase64: z.string().min(1),
});

const cognoteNoteSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  categoryKey: z.string().min(1),
  categoryLabel: z.string().optional(),
  tier: contentTierSchema,
  tags: z.array(z.string()).default([]),
  sources: z.array(sourceInputSchema).default([]),
  figures: z.array(cognoteFigureSchema).default([]),
});

export const cognoteFileSchema = z.object({
  format: z.literal("cognote"),
  schemaVersion: z.literal(COGNOTE_VERSION),
  app: z.string().optional(),
  exportedAt: z.string().optional(),
  notes: z.array(cognoteNoteSchema).min(1),
});

export type CognoteFile = z.infer<typeof cognoteFileSchema>;
export type CognoteNote = z.infer<typeof cognoteNoteSchema>;

const MIME_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

async function figuresForEntry(entryId: string) {
  return db
    .select({
      id: figures.id,
      filename: figures.filename,
      kind: figures.kind,
      caption: figures.caption,
      page: figures.page,
    })
    .from(figures)
    .where(inArray(figures.entryId, [entryId]));
}

/** Package the given entries (with their figures embedded) for sharing. */
export async function buildCognote(entryIds: string[]): Promise<CognoteFile> {
  const notes: CognoteNote[] = [];

  for (const id of entryIds) {
    const entry = await getEntry(id);
    if (!entry) continue;

    const figureRows = await figuresForEntry(id);
    const packedFigures: CognoteNote["figures"] = [];
    for (const row of figureRows) {
      const filePath = path.join(FIGURES_DIR, path.basename(row.filename));
      if (!fs.existsSync(filePath)) continue;
      const ext = path.extname(filePath).toLowerCase();
      if (!MIME_EXT.has(ext)) continue;
      packedFigures.push({
        oldId: row.id,
        kind: row.kind,
        caption: row.caption,
        page: row.page,
        ext: ext as CognoteNote["figures"][number]["ext"],
        dataBase64: fs.readFileSync(filePath).toString("base64"),
      });
    }

    notes.push({
      title: entry.title,
      content: entry.content,
      categoryKey: entry.categoryKey,
      tier: entry.tier,
      tags: entry.tags,
      sources: entry.sources.map((s) => ({
        type: s.type,
        citation: s.citation,
        url: s.url,
        authors: s.authors,
        year: s.year,
      })),
      figures: packedFigures,
    });
  }

  return {
    format: "cognote",
    schemaVersion: COGNOTE_VERSION,
    app: "Cognitio",
    exportedAt: new Date().toISOString(),
    notes,
  };
}

export interface CognoteImportResult {
  imported: CodexEntry[];
  skipped: number;
}

/** Import a parsed .cognote file: figures are written to disk under fresh
 * ids (the sender's ids mean nothing here), content URLs are rewritten to
 * match, and unknown categories fall back to the first leaf so a note from
 * someone with a customized taxonomy still lands somewhere sensible. */
export async function importCognote(file: CognoteFile): Promise<CognoteImportResult> {
  const validKeys = new Set(getLeafCategories().map((c) => c.key));
  const fallbackKey = getLeafCategories()[0]!.key;
  const imported: CodexEntry[] = [];
  let skipped = 0;

  fs.mkdirSync(FIGURES_DIR, { recursive: true });

  for (const note of file.notes) {
    try {
      let content = note.content;
      const figureIds: string[] = [];
      const timestamp = new Date().toISOString();

      for (const fig of note.figures) {
        const newId = randomUUID();
        const filename = `${newId}${fig.ext}`;
        fs.writeFileSync(path.join(FIGURES_DIR, filename), Buffer.from(fig.dataBase64, "base64"));
        await db.insert(figures).values({
          id: newId,
          jobId: null,
          entryId: null, // attached below, once the entry exists
          filename,
          kind: fig.kind,
          caption: fig.caption,
          page: fig.page ?? null,
          createdAt: timestamp,
        });
        content = content.split(`/api/figures/${fig.oldId}`).join(`/api/figures/${newId}`);
        figureIds.push(newId);
      }

      const { entry } = await createEntry({
        title: note.title,
        content,
        categoryKey: validKeys.has(note.categoryKey) ? note.categoryKey : fallbackKey,
        tier: note.tier,
        tags: note.tags,
        sources: note.sources.length
          ? note.sources
          : [{ type: "other" as const, citation: "공유받은 노트 (shared note)" }],
        relatedEntryIds: [],
        figureIds,
        status: "draft",
      });
      await attachFiguresToEntry(entry.id, figureIds);
      imported.push(entry);
    } catch {
      skipped += 1;
    }
  }

  return { imported, skipped };
}
