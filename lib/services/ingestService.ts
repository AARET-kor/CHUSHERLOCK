import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { ingestJobs } from "../db/schema";
import { processDocument } from "../ai/classify";
import { extractText } from "../ingest/extract";
import {
  extractPdfFigures,
  extractEmbeddedMedia,
  listJobFigures,
  type FigureRecord,
} from "../ingest/figures";
import type { SuggestedEntry } from "../ai/schemas";

export interface CreateIngestJobInput {
  /** Uploaded file bytes; mutually exclusive with pastedText. */
  file?: { buffer: Buffer; filename: string };
  pastedText?: string;
  sourceCitation: string;
  sourceType: string;
  sourceUrl?: string;
}

export type IngestJobView = typeof ingestJobs.$inferSelect;

function nowIso(): string {
  return new Date().toISOString();
}

export async function getIngestJob(id: string): Promise<IngestJobView | null> {
  const [row] = await db.select().from(ingestJobs).where(eq(ingestJobs.id, id));
  return row ?? null;
}

async function updateJob(id: string, patch: Partial<typeof ingestJobs.$inferInsert>): Promise<void> {
  await db
    .update(ingestJobs)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(ingestJobs.id, id));
}

/**
 * Creates the job row and kicks off processing in the background (the API
 * route returns immediately; the UI polls GET /api/ingest/[id]). Extraction
 * happens inside the job too — scanned-PDF OCR alone can take minutes.
 */
export async function startIngestJob(input: CreateIngestJobInput): Promise<IngestJobView> {
  const id = randomUUID();
  const timestamp = nowIso();

  await db.insert(ingestJobs).values({
    id,
    sourceLabel: input.file?.filename ?? "붙여넣은 텍스트",
    sourceCitation: input.sourceCitation,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  void runJob(id, input).catch(async (error) => {
    await updateJob(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    });
  });

  const job = await getIngestJob(id);
  if (!job) throw new Error("Failed to load ingest job immediately after creation.");
  return job;
}

async function extractFigures(jobId: string, file: { buffer: Buffer; filename: string }): Promise<FigureRecord[]> {
  const lower = file.filename.toLowerCase();
  try {
    if (lower.endsWith(".pdf")) return await extractPdfFigures(file.buffer, jobId);
    if (lower.endsWith(".docx")) return await extractEmbeddedMedia(file.buffer, jobId, "word/media/");
    if (lower.endsWith(".pptx")) return await extractEmbeddedMedia(file.buffer, jobId, "ppt/media/");
  } catch (error) {
    // Figures are an enhancement — a failure here must not sink the whole
    // ingest run; the text pipeline continues without them.
    console.warn("[figures] extraction failed:", error instanceof Error ? error.message : error);
  }
  return [];
}

async function runJob(id: string, input: CreateIngestJobInput): Promise<void> {
  await updateJob(id, { status: "extracting" });

  let text: string;
  let formatNote: string;
  let sourceLabel: string;
  let jobFigures: FigureRecord[] = [];

  if (input.file) {
    const extracted = await extractText(input.file.buffer, input.file.filename);
    text = extracted.text;
    formatNote = extracted.formatNote;
    sourceLabel = input.file.filename;
    jobFigures = await extractFigures(id, input.file);
  } else {
    text = input.pastedText ?? "";
    formatNote = "직접 입력";
    sourceLabel = "붙여넣은 텍스트";
  }

  if (!text.trim()) {
    throw new Error("문서에서 텍스트를 추출하지 못했습니다.");
  }

  await updateJob(id, { status: "processing" });

  const result = await processDocument(
    {
      text,
      sourceLabel,
      sourceCitation: input.sourceCitation,
      formatNote,
      figures: jobFigures,
    },
    {
      onProgress: async (processed, total) => {
        await updateJob(id, { processedChunks: processed, totalChunks: total });
      },
    }
  );

  await updateJob(id, {
    status: "completed",
    totalChunks: result.chunkCount,
    processedChunks: result.chunkCount,
    suggestions: result.suggestions satisfies SuggestedEntry[],
  });
}

export { listJobFigures };
