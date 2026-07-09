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

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // Claude PDF request limit is 32MB

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
        { error: "파일이 너무 큽니다 (최대 30MB). 파일을 나눠서 올려 주세요." },
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
