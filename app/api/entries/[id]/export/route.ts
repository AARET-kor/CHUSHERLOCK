import { NextResponse } from "next/server";
import { getEntry, listEntries, markExported } from "../../../../../lib/services/entryService";
import { entryToMarkdown } from "../../../../../lib/codex/markdown-export";
import { entryToHtmlDocument, entryToDocx } from "../../../../../lib/export/render";

function sanitizeBase(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "").trim() || "note";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "md";

  const entry = await getEntry(id);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  await markExported([entry.id]);

  const base = sanitizeBase(entry.title);

  if (format === "docx") {
    const buffer = await entryToDocx(entry);
    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.docx"`,
      },
    });
  }

  if (format === "html") {
    const html = await entryToHtmlDocument(entry);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.html"`,
      },
    });
  }

  // default: Obsidian-flavoured markdown
  const allEntries = await listEntries();
  const titleById = new Map(allEntries.map((e) => [e.id, e.title]));
  const file = entryToMarkdown(entry, titleById);
  const filename = file.relativePath.split("/").pop() ?? `${entry.id}.md`;

  return new NextResponse(file.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
