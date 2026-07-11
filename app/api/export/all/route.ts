import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import {
  listEntries,
  markExported,
  figureFilesForEntries,
} from "../../../../lib/services/entryService";
import { entriesToMarkdownFiles } from "../../../../lib/codex/markdown-export";
import { FIGURES_DIR } from "../../../../lib/ingest/figures";

// Exports every entry as an Obsidian-vault-shaped folder of Markdown files
// inside one .zip, so the user can unzip straight into (or on top of) their
// existing Obsidian vault without any live Obsidian connection. Cropped
// source figures ship alongside under _figures/ with links rewritten from
// the app URL to vault-relative paths.
export async function GET() {
  const entries = await listEntries();
  const files = entriesToMarkdownFiles(entries);
  const figureFiles = await figureFilesForEntries(entries.map((e) => e.id));

  const zip = new JSZip();
  for (const file of files) {
    const depth = file.relativePath.split("/").length - 1;
    const prefix = "../".repeat(depth);
    const content = file.content.replace(
      /\]\(\/api\/figures\/([0-9a-f-]+)\)/g,
      (match, figureId: string) => {
        const filename = figureFiles.get(figureId);
        return filename ? `](${prefix}_figures/${filename})` : match;
      }
    );
    zip.file(`Cognitio/${file.relativePath}`, content);
  }

  for (const filename of figureFiles.values()) {
    const filePath = path.join(FIGURES_DIR, path.basename(filename));
    if (fs.existsSync(filePath)) {
      zip.file(`Cognitio/_figures/${filename}`, fs.readFileSync(filePath));
    }
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  await markExported(entries.map((e) => e.id));

  return new NextResponse(new Blob([buffer]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="cognitio-export.zip"`,
    },
  });
}
