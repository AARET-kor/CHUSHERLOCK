import fs from "node:fs";
import path from "node:path";
import { sqliteClient } from "../db/client";
import { FIGURES_DIR } from "../ingest/figures";

const FIGURE_FILE = /^[0-9a-f-]{36}\.(png|jpe?g|gif|webp)$/i;

export interface StorageCleanupReport {
  dryRun: boolean;
  orphanFiles: string[];
  orphanFigureRows: string[];
  orphanSources: number;
}

/**
 * Reconcile figure files and relational rows. A grace period prevents a
 * concurrent import/ingest file from being mistaken for an orphan between
 * its filesystem write and DB commit.
 */
export function cleanupOrphanStorage(options: {
  dryRun?: boolean;
  graceMs?: number;
} = {}): StorageCleanupReport {
  const dryRun = options.dryRun ?? true;
  const graceMs = options.graceMs ?? 24 * 60 * 60_000;
  const cutoffMs = Date.now() - graceMs;
  fs.mkdirSync(FIGURES_DIR, { recursive: true });

  const figureRows = sqliteClient
    .prepare("SELECT id, filename, entry_id, job_id, created_at FROM figures")
    .all() as Array<{
    id: string;
    filename: string;
    entry_id: string | null;
    job_id: string | null;
    created_at: string;
  }>;
  const knownFiles = new Set(figureRows.map((row) => path.basename(row.filename)));
  const orphanFiles = fs
    .readdirSync(FIGURES_DIR)
    .filter((filename) => FIGURE_FILE.test(filename))
    .filter((filename) => !knownFiles.has(filename))
    .filter((filename) => fs.statSync(path.join(FIGURES_DIR, filename)).mtimeMs < cutoffMs);

  const orphanFigureRows = figureRows
    .filter((row) => !row.entry_id && !row.job_id)
    .filter((row) => Date.parse(row.created_at) < cutoffMs)
    .map((row) => row.id);

  const orphanSources = (
    sqliteClient
      .prepare(
        `SELECT COUNT(*) AS count
           FROM sources s
          WHERE NOT EXISTS (
            SELECT 1 FROM entry_sources es WHERE es.source_id = s.id
          )`
      )
      .get() as { count: number }
  ).count;

  if (!dryRun) {
    for (const filename of orphanFiles) {
      fs.rmSync(path.join(FIGURES_DIR, filename), { force: true });
    }
    sqliteClient
      .transaction(() => {
        const deleteFigure = sqliteClient.prepare("DELETE FROM figures WHERE id = ?");
        for (const id of orphanFigureRows) deleteFigure.run(id);
        sqliteClient.prepare(
          `DELETE FROM sources
            WHERE NOT EXISTS (
              SELECT 1 FROM entry_sources es WHERE es.source_id = sources.id
            )`
        ).run();
      })
      .immediate();
  }

  return { dryRun, orphanFiles, orphanFigureRows, orphanSources };
}
