import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { inArray } from "drizzle-orm";
import { applyDecorations } from "../codex/decorations";
import { db } from "../db/client";
import { figures } from "../db/schema";
import { FIGURES_DIR } from "../ingest/figures";
import { getCategory } from "../codex/taxonomy";
import { getTierInfo } from "../codex/tiers";
import type { CodexEntry } from "../codex/types";

const FIGURE_URL_PATTERN = /\/api\/figures\/([0-9a-f-]+)/g;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** Replace app-served figure URLs with self-contained base64 data URIs so
 * exported files never depend on the app being up (and never break). */
async function inlineFigures(markdown: string): Promise<string> {
  const ids = Array.from(new Set(Array.from(markdown.matchAll(FIGURE_URL_PATTERN), (m) => m[1]!)));
  if (ids.length === 0) return markdown;

  const rows = await db
    .select({ id: figures.id, filename: figures.filename })
    .from(figures)
    .where(inArray(figures.id, ids));

  let result = markdown;
  for (const row of rows) {
    const filePath = path.join(FIGURES_DIR, path.basename(row.filename));
    if (!fs.existsSync(filePath)) continue;
    const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "image/png";
    const dataUri = `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
    result = result.split(`/api/figures/${row.id}`).join(dataUri);
  }
  return result;
}

function markdownToHtml(markdown: string): string {
  // Escape & and < only — neutralizes raw HTML while keeping ">" intact so
  // blockquotes still parse (same rule as components/MarkdownContent).
  const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = marked.parse(escaped, { breaks: true, async: false }) as string;
  // Inline styles so highlights/pen colors survive in files that travel
  // without our stylesheet (Word, standalone HTML).
  return applyDecorations(html, "inline");
}

/** Standalone HTML document for one note — used directly for .html export
 * and as the input to the .docx converter. */
export async function entryToHtmlDocument(entry: CodexEntry): Promise<string> {
  const category = getCategory(entry.categoryKey);
  const tier = getTierInfo(entry.tier);
  const body = markdownToHtml(await inlineFigures(entry.content));

  const sources = entry.sources
    .map((s) => `<li>${s.citation}${s.url ? ` — <a href="${s.url}">${s.url}</a>` : ""}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${entry.title}</title>
<style>
  body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", "Pretendard", sans-serif; color: #0D212C; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.7; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .meta { color: #51626B; font-size: 13px; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
  th, td { border: 1px solid #d7dce0; padding: 6px 10px; text-align: left; }
  th { background: #F4F4F6; }
  blockquote { border-left: 3px solid #f59e0b; background: #fffbeb; margin: 12px 0; padding: 8px 14px; }
  img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
  code { background: #F4F4F6; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .sources { margin-top: 32px; font-size: 13px; color: #51626B; }
</style>
</head>
<body>
<h1>${entry.title}</h1>
<p class="meta">${tier.labelKo} · ${category.labelKo} / ${category.labelEn} · ${new Date(entry.updatedAt).toLocaleDateString("ko-KR")}</p>
${body}
<div class="sources">
<strong>출처 (Sources)</strong>
<ul>${sources}</ul>
</div>
</body>
</html>`;
}

export async function entryToDocx(entry: CodexEntry): Promise<Buffer> {
  const html = await entryToHtmlDocument(entry);
  const HTMLtoDOCX = (await import("html-to-docx")).default;
  return HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    font: "Apple SD Gothic Neo",
    fontSize: 22, // half-points → 11pt
    title: entry.title,
    lang: "ko-KR",
  });
}
