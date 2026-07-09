import { NextResponse } from "next/server";
import { getEntry, listEntries, markExported } from "../../../../../lib/services/entryService";
import { entryToMarkdown } from "../../../../../lib/codex/markdown-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  const allEntries = await listEntries();
  const titleById = new Map(allEntries.map((e) => [e.id, e.title]));
  const file = entryToMarkdown(entry, titleById);
  await markExported([entry.id]);

  const filename = file.relativePath.split("/").pop() ?? `${entry.id}.md`;

  return new NextResponse(file.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
