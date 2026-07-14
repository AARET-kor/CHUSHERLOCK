import { NextResponse } from "next/server";
import { z } from "zod";
import { startIngestJob } from "../../../lib/services/ingestService";

const metadataSchema = z.object({
  sourceCitation: z.string().min(1, "출처(citation)를 입력해 주세요."),
  sourceType: z.enum([
    "paper",
    "textbook",
    "book",
    "course",
    "manufacturer_guideline",
    "personal_note",
    "website",
    "other",
  ]),
  sourceUrl: z.string().url().optional().or(z.literal("")),
});

// Upload cap. Text-layer PDFs and Word/PPT docs are extracted LOCALLY
// (pdf-parse / mammoth) with no per-page model cost, so their size barely
// affects token spend — the cap here is mostly a memory guard. Scanned PDFs
// that fall back to vision OCR are split into request-sized segments
// downstream (lib/ingest/ocr.ts), so a large scan is billed page-by-page,
// not rejected. Raise/lower with CODEX_MAX_UPLOAD_MB.
const MAX_UPLOAD_MB = Number(process.env.CODEX_MAX_UPLOAD_MB ?? 100);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();

  const parsedMeta = metadataSchema.safeParse({
    sourceCitation: String(formData.get("sourceCitation") ?? ""),
    sourceType: String(formData.get("sourceType") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
  });
  if (!parsedMeta.success) {
    return NextResponse.json(
      { error: parsedMeta.error.issues[0]?.message ?? "입력값을 확인해 주세요." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const pastedText = String(formData.get("text") ?? "").trim();

  let fileInput: { buffer: Buffer; filename: string } | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `파일이 너무 큽니다 (최대 ${MAX_UPLOAD_MB}MB). 더 큰 파일이 필요하면 CODEX_MAX_UPLOAD_MB 환경변수를 올리거나, 챕터별로 나눠서 올려 주세요.`,
        },
        { status: 400 }
      );
    }
    fileInput = { buffer: Buffer.from(await file.arrayBuffer()), filename: file.name };
  }

  if (!fileInput && !pastedText) {
    return NextResponse.json(
      { error: "파일을 올리거나 텍스트를 붙여넣어 주세요." },
      { status: 400 }
    );
  }

  const job = await startIngestJob({
    file: fileInput,
    pastedText: pastedText || undefined,
    sourceCitation: parsedMeta.data.sourceCitation,
    sourceType: parsedMeta.data.sourceType,
    sourceUrl: parsedMeta.data.sourceUrl || undefined,
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
