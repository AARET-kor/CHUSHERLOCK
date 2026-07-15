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

interface FigureExtraction {
  figures: FigureRecord[];
  /** Human-readable status shown to the user (success count or failure). */
  note: string;
}

async function extractFigures(
  jobId: string,
  file: { buffer: Buffer; filename: string }
): Promise<FigureExtraction> {
  const lower = file.filename.toLowerCase();
  const supported =
    lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".pptx");
  if (!supported) {
    return { figures: [], note: "이 형식은 그림 추출을 지원하지 않습니다 (PDF/DOCX/PPTX만)." };
  }
  try {
    let figures: FigureRecord[] = [];
    if (lower.endsWith(".pdf")) figures = await extractPdfFigures(file.buffer, jobId);
    else if (lower.endsWith(".docx"))
      figures = await extractEmbeddedMedia(file.buffer, jobId, "word/media/");
    else if (lower.endsWith(".pptx"))
      figures = await extractEmbeddedMedia(file.buffer, jobId, "ppt/media/");
    return {
      figures,
      note:
        figures.length > 0
          ? `그림·표·그래프 ${figures.length}개를 원본에서 잘라냈습니다.`
          : "문서에서 잘라낼 그림·표·그래프를 찾지 못했습니다.",
    };
  } catch (error) {
    // Figures are an enhancement — a failure here must not sink the whole
    // ingest run; the text pipeline continues without them. But the reason
    // is now surfaced (job.figureNote) instead of silently swallowed.
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[figures] extraction failed:", reason);
    return { figures: [], note: `그림 추출 중 오류가 발생했습니다: ${reason}` };
  }
}

async function runJob(id: string, input: CreateIngestJobInput): Promise<void> {
  await updateJob(id, { status: "extracting" });

  let text: string;
  let formatNote: string;
  let sourceLabel: string;
  let jobFigures: FigureRecord[] = [];
  let figureNote: string | null = null;

  if (input.file) {
    const extracted = await extractText(input.file.buffer, input.file.filename);
    text = extracted.text;
    formatNote = extracted.formatNote;
    sourceLabel = input.file.filename;
    const figureResult = await extractFigures(id, input.file);
    jobFigures = figureResult.figures;
    figureNote = figureResult.note;
    await updateJob(id, { figureNote });
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
