// Raw-text extraction for uploaded reference material. Everything downstream
// (chunking, classification) works on plain text, so this is the only place
// that knows about file formats.

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
    try {
      const result = await parser.getText();
      return {
        text: result.text,
        formatNote: `PDF, ${result.pages?.length ?? "?"} pages`,
      };
    } finally {
      await parser.destroy();
    }
  }

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, formatNote: "Word (.docx)" };
  }

  if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return { text: buffer.toString("utf-8"), formatNote: "텍스트 파일" };
  }

  throw new Error(
    "지원하지 않는 파일 형식입니다. PDF, DOCX, TXT, MD 파일을 올리거나 텍스트를 붙여넣어 주세요."
  );
}
