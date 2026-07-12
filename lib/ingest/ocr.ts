import { PDFDocument } from "pdf-lib";
import { getAnthropicClient, isFakeMode, LIGHT_MODEL } from "../ai/client";

// OCR for scanned material via Claude vision. Used when pdf-parse finds
// (almost) no text layer, and for photo uploads of book pages / parameter
// sheets. Large PDFs are split into page segments so each transcription
// call stays well inside output limits.

export const OCR_SEGMENT_PAGES = 15;

/** Heuristic: a real text layer averages hundreds of chars per page; a
 * scanned PDF yields nearly nothing. */
export function needsOcr(extractedText: string, pageCount: number): boolean {
  const length = extractedText.trim().length;
  if (pageCount <= 0) return length < 50;
  return length / pageCount < 120;
}

/** Inclusive 0-based [start, end] page ranges of at most `segmentSize`. */
export function pageRanges(totalPages: number, segmentSize = OCR_SEGMENT_PAGES): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let start = 0; start < totalPages; start += segmentSize) {
    ranges.push([start, Math.min(start + segmentSize, totalPages) - 1]);
  }
  return ranges;
}

const OCR_INSTRUCTION = `이 문서는 스캔본/사진입니다. 보이는 모든 텍스트를 빠짐없이 그대로(verbatim) 전사하세요.

- 요약하거나 생략하지 마세요. 파라미터, 수치, 표의 값은 특히 정확하게.
- 한글/영어는 원문 그대로 유지하세요.
- 문서 구조(제목, 소제목, 목록, 표)는 Markdown으로 표현하세요. 표는 Markdown 표로.
- 그림/사진 자체는 전사하지 말고, 캡션이 있으면 캡션만 전사하세요.
- 페이지가 여러 장이면 페이지 순서대로 이어서 쓰세요.
- 전사한 텍스트만 출력하고, 다른 설명은 붙이지 마세요.`;

async function transcribePdfSegment(pdfBase64: string): Promise<string> {
  const client = getAnthropicClient();
  // Verbatim transcription needs no reasoning — the light model does this
  // at a fraction of the cost, and omitting `thinking` (unsupported on
  // Haiku anyway) saves the thinking tokens entirely.
  const stream = client.messages.stream({
    model: LIGHT_MODEL,
    max_tokens: 64000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: OCR_INSTRUCTION },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("모델이 이 문서의 OCR을 거부했습니다 (safety refusal).");
  }
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

async function extractPageSegment(
  source: PDFDocument,
  start: number,
  end: number
): Promise<string> {
  const segment = await PDFDocument.create();
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const pages = await segment.copyPages(source, indices);
  for (const page of pages) segment.addPage(page);
  return segment.saveAsBase64();
}

export async function ocrPdf(
  buffer: Buffer,
  onProgress?: (segment: number, totalSegments: number) => void | Promise<void>
): Promise<string> {
  if (isFakeMode()) {
    return "[FAKE OCR] 스캔본 PDF에서 전사된 텍스트입니다.\n\n" + "예시 본문 내용. ".repeat(50);
  }

  const source = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  const ranges = pageRanges(source.getPageCount());
  const parts: string[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i]!;
    const segmentBase64 = await extractPageSegment(source, start, end);
    parts.push(await transcribePdfSegment(segmentBase64));
    await onProgress?.(i + 1, ranges.length);
  }

  return parts.join("\n\n");
}

const IMAGE_MEDIA_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function imageMediaType(filename: string) {
  const lower = filename.toLowerCase();
  const ext = Object.keys(IMAGE_MEDIA_TYPES).find((e) => lower.endsWith(e));
  return ext ? IMAGE_MEDIA_TYPES[ext] : undefined;
}

export async function ocrImage(buffer: Buffer, filename: string): Promise<string> {
  if (isFakeMode()) {
    return "[FAKE OCR] 사진에서 전사된 텍스트입니다. 예시 내용.";
  }

  const mediaType = imageMediaType(filename);
  if (!mediaType) throw new Error("지원하지 않는 이미지 형식입니다 (jpg/png/webp/gif).");

  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: LIGHT_MODEL,
    max_tokens: 32000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") },
          },
          { type: "text", text: OCR_INSTRUCTION },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("모델이 이 이미지의 OCR을 거부했습니다 (safety refusal).");
  }
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}
