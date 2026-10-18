import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { figures } from "../db/schema";
import { FIGURES_DIR } from "../ingest/figures";
import { getLeafCategories } from "../codex/taxonomy";
import {
  claimInputSchema,
  contentTierSchema,
  sourceInputSchema,
} from "../schemas/entrySchemas";
import {
  createEntry,
  getEntry,
  type PreparedFigure,
} from "../services/entryService";
import type { CodexEntry } from "../codex/types";

// .cognote — Cognitio's note-sharing format. A single self-contained JSON
// file: note bodies keep their Markdown + decoration markers verbatim, and
// every cropped figure travels inside as base64, so the receiver gets the
// note exactly as the sender sees it — colors, tables, images and all.

export const COGNOTE_VERSION = 1;
export const COGNOTE_MAX_FILE_BYTES =
  Number(process.env.CODEX_COGNOTE_MAX_MB ?? 50) * 1024 * 1024;
export const COGNOTE_MAX_NOTES = Number(process.env.CODEX_COGNOTE_MAX_NOTES ?? 100);
export const COGNOTE_MAX_FIGURES = Number(process.env.CODEX_COGNOTE_MAX_FIGURES ?? 500);
export const COGNOTE_MAX_FIGURE_BYTES =
  Number(process.env.CODEX_COGNOTE_MAX_FIGURE_MB ?? 10) * 1024 * 1024;
export const COGNOTE_MAX_DECODED_BYTES =
  Number(process.env.CODEX_COGNOTE_MAX_DECODED_MB ?? 40) * 1024 * 1024;
const MAX_NOTE_CONTENT_CHARS = 250_000;
const MAX_TOTAL_CONTENT_CHARS = 2_000_000;

const cognoteFigureSchema = z.object({
  /** The sender's figure id — referenced by /api/figures/{oldId} URLs
   * inside the note content; rewritten to a fresh id on import. */
  oldId: z.string().min(1),
  kind: z.enum(["figure", "table", "chart", "photo"]),
  caption: z.string().max(1000),
  page: z.number().int().nullable().optional(),
  /** File extension incl. dot, whitelisted so imports can't write
   * arbitrary paths or executable files. */
  ext: z.enum([".png", ".jpg", ".jpeg", ".gif", ".webp"]),
  dataBase64: z
    .string()
    .min(1)
    .max(Math.ceil(COGNOTE_MAX_FIGURE_BYTES / 3) * 4 + 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "invalid base64"),
});

const cognoteNoteSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(MAX_NOTE_CONTENT_CHARS),
  categoryKey: z.string().min(1),
  categoryLabel: z.string().optional(),
  tier: contentTierSchema,
  tags: z.array(z.string().min(1).max(100)).max(100).default([]),
  sources: z.array(sourceInputSchema).max(50).default([]),
  figures: z.array(cognoteFigureSchema).max(50).default([]),
  claims: z.array(claimInputSchema).max(50).default([]),
});

export const cognoteFileSchema = z.object({
  format: z.literal("cognote"),
  schemaVersion: z.literal(COGNOTE_VERSION),
  app: z.string().optional(),
  exportedAt: z.string().optional(),
  notes: z.array(cognoteNoteSchema).min(1).max(COGNOTE_MAX_NOTES),
}).superRefine((file, context) => {
  const figureCount = file.notes.reduce((sum, note) => sum + note.figures.length, 0);
  const contentChars = file.notes.reduce((sum, note) => sum + note.content.length, 0);
  const decodedBytes = file.notes.reduce(
    (sum, note) =>
      sum +
      note.figures.reduce(
        (figureSum, figure) => figureSum + estimatedDecodedBytes(figure.dataBase64),
        0
      ),
    0
  );
  if (figureCount > COGNOTE_MAX_FIGURES) {
    context.addIssue({ code: "custom", message: `그림은 최대 ${COGNOTE_MAX_FIGURES}개입니다.` });
  }
  if (contentChars > MAX_TOTAL_CONTENT_CHARS) {
    context.addIssue({ code: "custom", message: "노트 본문 총량이 제한을 초과합니다." });
  }
  if (decodedBytes > COGNOTE_MAX_DECODED_BYTES) {
    context.addIssue({ code: "custom", message: "이미지 저장 총량이 제한을 초과합니다." });
  }
});

export type CognoteFile = z.infer<typeof cognoteFileSchema>;
export type CognoteNote = z.infer<typeof cognoteNoteSchema>;

const MIME_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const FIGURE_KINDS = new Set(["figure", "table", "chart", "photo"]);

function estimatedDecodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function detectedImageExt(buffer: Buffer): ".png" | ".jpg" | ".gif" | ".webp" | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return ".png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  const header = buffer.subarray(0, 6).toString("ascii");
  if (header === "GIF87a" || header === "GIF89a") return ".gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }
  return null;
}

export function decodeCognoteFigure(figure: CognoteNote["figures"][number]): Buffer {
  const buffer = Buffer.from(figure.dataBase64, "base64");
  if (buffer.length === 0 || buffer.length > COGNOTE_MAX_FIGURE_BYTES) {
    throw new Error("이미지 크기 제한을 초과했습니다.");
  }
  const detected = detectedImageExt(buffer);
  const expected = figure.ext === ".jpeg" ? ".jpg" : figure.ext;
  if (!detected || detected !== expected) {
    throw new Error(`이미지 내용과 확장자가 일치하지 않습니다 (${figure.ext}).`);
  }
  return buffer;
}

/** Validate decoded payloads and reserve enough free disk before writing. */
export function assertCognoteResources(file: CognoteFile): void {
  let decodedBytes = 0;
  for (const note of file.notes) {
    for (const figure of note.figures) decodedBytes += decodeCognoteFigure(figure).length;
  }
  if (decodedBytes > COGNOTE_MAX_DECODED_BYTES) {
    throw new Error("이미지 저장 총량이 제한을 초과합니다.");
  }
  fs.mkdirSync(FIGURES_DIR, { recursive: true });
  const stats = fs.statfsSync(FIGURES_DIR);
  const available = Number(stats.bavail) * Number(stats.bsize);
  const reserve = Number(process.env.CODEX_DISK_RESERVE_MB ?? 100) * 1024 * 1024;
  if (decodedBytes > Math.max(0, available - reserve)) {
    throw new Error("이미지를 안전하게 가져올 디스크 여유 공간이 부족합니다.");
  }
}

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
      if (!FIGURE_KINDS.has(row.kind)) continue;
      packedFigures.push({
        oldId: row.id,
        kind: row.kind as CognoteNote["figures"][number]["kind"],
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
        versionLabel: s.versionLabel,
        validUntil: s.validUntil,
        evidenceLevel: s.evidenceLevel,
      })),
      figures: packedFigures,
      claims: entry.claims.map((claim) => ({
        claimText: claim.claimText,
        representation: claim.representation,
        originalQuote: claim.originalQuote,
        sourceLocation: claim.sourceLocation,
        pageStart: claim.pageStart,
        pageEnd: claim.pageEnd,
        section: claim.section,
        sourceIndex: Math.max(
          0,
          entry.sources.findIndex((source) => source.id === claim.sourceId)
        ),
        evidenceLevel: claim.evidenceLevel,
        conflictStatus: claim.conflictStatus,
        conflictNote: claim.conflictNote,
        verifiedBy: claim.verifiedBy,
        verifiedAt: claim.verifiedAt,
      })),
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
  assertCognoteResources(file);
  const validKeys = new Set(getLeafCategories().map((c) => c.key));
  const fallbackKey = getLeafCategories()[0]!.key;
  const imported: CodexEntry[] = [];
  let skipped = 0;

  fs.mkdirSync(FIGURES_DIR, { recursive: true });

  for (const note of file.notes) {
    const writtenFiles: string[] = [];
    try {
      let content = note.content;
      const timestamp = new Date().toISOString();
      const preparedFigures: PreparedFigure[] = [];

      for (const fig of note.figures) {
        const newId = randomUUID();
        const filename = `${newId}${fig.ext}`;
        const filePath = path.join(FIGURES_DIR, filename);
        fs.writeFileSync(filePath, decodeCognoteFigure(fig), { flag: "wx" });
        writtenFiles.push(filePath);
        preparedFigures.push({
          id: newId,
          filename,
          kind: fig.kind,
          caption: fig.caption,
          page: fig.page ?? null,
          createdAt: timestamp,
        });
        content = content.split(`/api/figures/${fig.oldId}`).join(`/api/figures/${newId}`);
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
        figureIds: [],
        claims: note.claims,
        status: "draft",
      }, { preparedFigures });
      imported.push(entry);
    } catch {
      for (const filePath of writtenFiles) fs.rmSync(filePath, { force: true });
      skipped += 1;
    }
  }

  return { imported, skipped };
}
