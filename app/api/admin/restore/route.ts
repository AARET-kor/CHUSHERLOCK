import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { FIGURES_DIR } from "../../../../lib/ingest/figures";

/**
 * One-time data move into a hosted deployment (Railway volume has no file
 * upload). Off unless CODEX_RESTORE_ENABLED=1, and refuses to run on a
 * server without CODEX_ACCESS_TOKEN, so the middleware always guards it.
 *
 *   PUT ?file=codex.sqlite   → staged; swapped in by scripts/restore-staged-db.mjs on next boot
 *   PUT ?file=figures/<name> → written straight into FIGURES_DIR
 */
const STAGED_DB = path.join(path.dirname(process.env.CODEX_DB_PATH ?? "./data/codex.sqlite"), "restore", "codex.sqlite");

const FIGURE_NAME = /^[A-Za-z0-9-]+\.(png|jpg|gif|webp)$/;

export async function PUT(request: Request) {
  if (process.env.CODEX_RESTORE_ENABLED !== "1" || !process.env.CODEX_ACCESS_TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const file = new URL(request.url).searchParams.get("file") ?? "";
  let target: string;
  if (file === "codex.sqlite") {
    target = STAGED_DB;
  } else if (file.startsWith("figures/") && FIGURE_NAME.test(file.slice("figures/".length))) {
    target = path.join(FIGURES_DIR, file.slice("figures/".length));
  } else {
    return NextResponse.json({ error: "unsupported file" }, { status: 400 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return NextResponse.json({ error: "empty body" }, { status: 400 });

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.part`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, target);
  return NextResponse.json({ ok: true, file, bytes: bytes.length });
}
