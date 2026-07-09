import { NextResponse } from "next/server";
import { z } from "zod";
import { extractText } from "../../../lib/ingest/extract";
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

  let text: string;
  let sourceLabel: string;
  let formatNote: string;

  try {
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractText(buffer, file.name);
      text = extracted.text;
      sourceLabel = file.name;
      formatNote = extracted.formatNote;
    } else if (pastedText) {
      text = pastedText;
      sourceLabel = "붙여넣은 텍스트";
      formatNote = "직접 입력";
    } else {
      return NextResponse.json(
        { error: "파일을 올리거나 텍스트를 붙여넣어 주세요." },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "파일 처리에 실패했습니다." },
      { status: 400 }
    );
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "문서에서 텍스트를 추출하지 못했습니다." },
      { status: 400 }
    );
  }

  const job = await startIngestJob({
    text,
    sourceLabel,
    formatNote,
    sourceCitation: parsedMeta.data.sourceCitation,
    sourceType: parsedMeta.data.sourceType,
    sourceUrl: parsedMeta.data.sourceUrl || undefined,
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
