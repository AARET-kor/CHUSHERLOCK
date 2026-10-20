// Boot step for hosted deploys: if /api/admin/restore staged a database,
// swap it in before migrations run (the server is not up yet, so nothing
// holds the old file open).
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.CODEX_DB_PATH ?? "./data/codex.sqlite";
const staged = path.join(path.dirname(dbPath), "restore", "codex.sqlite");

if (fs.existsSync(staged)) {
  if (fs.existsSync(dbPath)) fs.renameSync(dbPath, `${dbPath}.before-restore-${Date.now()}`);
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
  fs.renameSync(staged, dbPath);
  console.log(`Restored staged database into ${dbPath}.`);
}
