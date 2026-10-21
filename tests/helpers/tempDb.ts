import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Points the app at a fresh migrated SQLite file in a temp dir. Must run
 * before anything imports lib/db/client (it reads CODEX_DB_PATH on load). */
export async function setupTempDb(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  process.env.CODEX_DB_PATH = path.join(dir, "test.sqlite");
  process.env.CODEX_FIGURES_DIR = path.join(dir, "figures");
  process.env.CODEX_INGEST_PAYLOAD_DIR = path.join(dir, "ingest");
  process.env.CODEX_PHOTOS_DIR = path.join(dir, "photos");
  process.env.CODEX_AI_MODE = "fake";

  const [{ db, sqliteClient }, { migrate }, taxonomy] = await Promise.all([
    import("../../lib/db/client"),
    import("drizzle-orm/better-sqlite3/migrator"),
    import("../../lib/codex/taxonomy"),
  ]);
  if (sqliteClient.name !== process.env.CODEX_DB_PATH) {
    throw new Error("db client loaded before setupTempDb");
  }
  migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  const insert = sqliteClient.prepare(
    `INSERT OR IGNORE INTO categories
      (key, label_ko, label_en, parent_key, description_ko, description_en)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const c of taxonomy.CATEGORY_TAXONOMY) {
    insert.run(c.key, c.labelKo, c.labelEn, c.parentKey ?? null, c.descriptionKo ?? null, c.descriptionEn ?? null);
  }
  return {
    sqliteClient,
    cleanup() {
      sqliteClient.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
