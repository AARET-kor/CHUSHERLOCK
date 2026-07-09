import JSZip from "jszip";
import { NextResponse } from "next/server";
import { listEntries, markExported } from "../../../../lib/services/entryService";
import { entriesToMarkdownFiles } from "../../../../lib/codex/markdown-export";

// Exports every entry as an Obsidian-vault-shaped folder of Markdown files
// inside one .zip, so the user can unzip straight into (or on top of) their
// existing Obsidian vault without any live Obsidian connection.
export async function GET() {
  const entries = await listEntries();
  const files = entriesToMarkdownFiles(entries);

  const zip = new JSZip();
  for (const file of files) {
    zip.file(`New Codex/${file.relativePath}`, file.content);
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  await markExported(entries.map((e) => e.id));

  return new NextResponse(new Blob([buffer]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="new-codex-export.zip"`,
    },
  });
}
