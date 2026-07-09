// Raw-text extraction for uploaded reference material. Everything downstream
// (chunking, classification) works on plain text, so this is the only place
// that knows about file formats.
//
// Scanned PDFs (no text layer) and photos of pages fall back to Claude
// vision OCR (lib/ingest/ocr.ts), which can take minutes — extraction runs
// inside the background ingest job, never in the request handler.

import { needsOcr, ocrPdf, ocrImage, imageMediaType } from "./ocr";

export interface ExtractedDocument {
  text: string;
  /** e.g. "PDF, 214 pages" — shown in the ingest job UI. */
  formatNote: string;
}

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv"];

export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDocument> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    let text: string;
    let pageCount: number;
    try {
      const result = await parser.getText();
      text = result.text;
      pageCount = result.pages?.length ?? 0;
    } finally {
      await parser.destroy();
    }

    if (needsOcr(text, pageCount)) {
      const ocrText = await ocrPdf(buffer);
      return {
        text: ocrText,
        formatNote: `PDF (스캔본, OCR), ${pageCount || "?"} pages`,
      };
    }

    return { text, formatNote: `PDF, ${pageCount || "?"} pages` };
  }

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, formatNote: "Word (.docx)" };
  }

  if (imageMediaType(filename)) {
    const text = await ocrImage(buffer, filename);
    return { text, formatNote: "사진 (OCR)" };
  }

  if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return { text: buffer.toString("utf-8"), formatNote: "텍스트 파일" };
  }

  throw new Error(
    "지원하지 않는 파일 형식입니다. PDF, DOCX, TXT, MD 또는 사진(JPG/PNG/WEBP)을 올리거나 텍스트를 붙여넣어 주세요."
  );
}
