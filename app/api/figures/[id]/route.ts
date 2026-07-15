import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db/client";
import { figures } from "../../../../lib/db/schema";
import { FIGURES_DIR } from "../../../../lib/ingest/figures";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(figures).where(eq(figures.id, id));
  if (!row) {
    // Surfaced in the dev terminal so a note showing no image tells you why.
    console.error(`[figures] no DB row for id=${id}`);
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const filePath = path.join(FIGURES_DIR, path.basename(row.filename));
  if (!fs.existsSync(filePath)) {
    console.error(
      `[figures] file missing on disk: ${path.resolve(filePath)} (FIGURES_DIR=${FIGURES_DIR}, cwd=${process.cwd()})`
    );
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(new Blob([new Uint8Array(buffer)]), {
    headers: {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
