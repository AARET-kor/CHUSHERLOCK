import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getAnthropicClient, isFakeMode, MODEL } from "../ai/client";
import { db } from "../db/client";
import { figures } from "../db/schema";

// Visual material is CROPPED from the source, never redrawn: pages are
// rendered to images, Claude vision locates figure/table/chart regions
// (pixel bounding boxes — 1:1 on Opus 4.7+), and sharp cuts the region out
// of the original render.

export const FIGURES_DIR = process.env.CODEX_FIGURES_DIR ?? "./data/figures";
/** Vision cost guard for very large documents. */
export const FIGURE_MAX_PAGES = Number(process.env.CODEX_FIGURE_MAX_PAGES ?? 150);
const RENDER_WIDTH = 1400;
const MIN_REGION_PX = 60;
const MIN_EMBEDDED_BYTES = 8 * 1024;

export interface FigureRecord {
  id: string;
  filename: string;
  kind: string;
  caption: string;
  page: number | null;
}

export interface FigureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "figure" | "table" | "chart" | "photo";
  caption: string;
}

/** Clamp a model-proposed box to the page bounds; null if degenerate. */
export function clampRegion(
  region: FigureRegion,
  pageWidth: number,
  pageHeight: number
): FigureRegion | null {
  const x = Math.max(0, Math.min(Math.round(region.x), pageWidth - 1));
  const y = Math.max(0, Math.min(Math.round(region.y), pageHeight - 1));
  const width = Math.min(Math.round(region.width), pageWidth - x);
  const height = Math.min(Math.round(region.height), pageHeight - y);
  if (width < MIN_REGION_PX || height < MIN_REGION_PX) return null;
  return { ...region, x, y, width, height };
}

function ensureDir(): void {
  fs.mkdirSync(FIGURES_DIR, { recursive: true });
}

async function saveFigure(
  jobId: string,
  buffer: Buffer,
  ext: string,
  kind: string,
  caption: string,
  page: number | null
): Promise<FigureRecord> {
  ensureDir();
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(FIGURES_DIR, filename), buffer);
  await db.insert(figures).values({
    id,
    jobId,
    filename,
    kind,
    caption,
    page,
    createdAt: new Date().toISOString(),
  });
  return { id, filename, kind, caption, page };
}

const DETECT_SCHEMA = {
  type: "object",
  properties: {
    regions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          x: { type: "integer" },
          y: { type: "integer" },
          width: { type: "integer" },
          height: { type: "integer" },
          kind: { type: "string", enum: ["figure", "table", "chart", "photo"] },
          caption: { type: "string" },
        },
        required: ["x", "y", "width", "height", "kind", "caption"],
        additionalProperties: false,
      },
    },
  },
  required: ["regions"],
  additionalProperties: false,
} as const;

async function detectRegions(pagePng: Buffer, width: number, height: number): Promise<FigureRegion[]> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: DETECT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: pagePng.toString("base64") },
          },
          {
            type: "text",
            text: `이 문서 페이지 이미지(${width}x${height}px)에서 본문 텍스트가 아닌 시각 자료 — 그림(figure), 사진(photo), 표(table), 그래프/차트(chart), 다이어그램 — 의 영역을 찾아 픽셀 bounding box로 반환하세요.

- 각 box는 해당 시각 자료 전체와 그 캡션(있다면)을 포함하도록 잡으세요.
- caption에는 자료의 캡션 텍스트(없으면 내용을 한 줄로 설명)를 쓰세요.
- 본문 문단, 페이지 머리글/꼬리글, 페이지 번호, 배경 장식은 제외하세요.
- 시각 자료가 없으면 빈 배열을 반환하세요.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") return [];
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];
  const parsed = JSON.parse(textBlock.text) as { regions: FigureRegion[] };
  return parsed.regions;
}

/** Render each PDF page, detect visual-material regions, crop them verbatim. */
export async function extractPdfFigures(
  buffer: Buffer,
  jobId: string,
  onProgress?: (page: number, totalPages: number) => void | Promise<void>
): Promise<FigureRecord[]> {
  if (isFakeMode()) return [];

  const [{ PDFParse }, sharp] = await Promise.all([import("pdf-parse"), import("sharp")]);
  const parser = new PDFParse({ data: buffer });
  const records: FigureRecord[] = [];

  try {
    const info = await parser.getInfo();
    const totalPages = Math.min(info.total ?? 0, FIGURE_MAX_PAGES);

    for (let page = 1; page <= totalPages; page++) {
      const shot = await parser.getScreenshot({ partial: [page], desiredWidth: RENDER_WIDTH });
      const rendered = shot.pages[0];
      if (!rendered) continue;
      const png = Buffer.from(rendered.data);
      const width = Math.round(rendered.width);
      const height = Math.round(rendered.height);

      const regions = await detectRegions(png, width, height);
      for (const raw of regions) {
        const region = clampRegion(raw, width, height);
        if (!region) continue;
        const cropped = await sharp.default(png).extract({
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
        }).png().toBuffer();
        records.push(await saveFigure(jobId, cropped, "png", region.kind, region.caption, page));
      }
      await onProgress?.(page, totalPages);
    }
  } finally {
    await parser.destroy();
  }

  return records;
}

const MEDIA_EXT: Record<string, string> = {
  ".png": "png",
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".gif": "gif",
  ".webp": "webp",
};

/** Pull embedded raster images out of a DOCX/PPTX (both are zips with a
 * media folder) — the images are copied byte-for-byte, never re-encoded. */
export async function extractEmbeddedMedia(
  buffer: Buffer,
  jobId: string,
  mediaPrefix: "word/media/" | "ppt/media/"
): Promise<FigureRecord[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const records: FigureRecord[] = [];

  const names = Object.keys(zip.files)
    .filter((name) => name.startsWith(mediaPrefix))
    .sort();

  for (const name of names) {
    const ext = MEDIA_EXT[path.extname(name).toLowerCase()];
    if (!ext) continue;
    const data = await zip.files[name]!.async("nodebuffer");
    if (data.length < MIN_EMBEDDED_BYTES) continue; // skip icons/bullets
    records.push(
      await saveFigure(jobId, data, ext, "photo", `문서 내장 이미지 (${path.basename(name)})`, null)
    );
  }

  return records;
}

export async function listJobFigures(jobId: string): Promise<FigureRecord[]> {
  const { eq } = await import("drizzle-orm");
  const rows = await db.select().from(figures).where(eq(figures.jobId, jobId));
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    kind: r.kind,
    caption: r.caption,
    page: r.page,
  }));
}
