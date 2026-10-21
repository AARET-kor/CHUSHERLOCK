// scripts/backup.mjs
// One file with the database (consistent online copy) and every photo:
//   backups/bbip-YYYYMMDD-HHMM.tgz
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.CODEX_DB_PATH ?? "./data/codex.sqlite";
const photosDir = process.env.CODEX_PHOTOS_DIR ?? "./data/photos";
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "bbip-backup-"));
fs.mkdirSync("backups", { recursive: true });
const out = path.resolve("backups", `bbip-${stamp}.tgz`);

const db = new Database(dbPath, { readonly: true });
await db.backup(path.join(work, "codex.sqlite"));
db.close();
const args = ["-czf", out, "-C", work, "codex.sqlite"];
if (fs.existsSync(photosDir)) args.push("-C", path.dirname(path.resolve(photosDir)), path.basename(photosDir));
execFileSync("tar", args);
fs.rmSync(work, { recursive: true, force: true });
console.log(`Backup written: ${out}`);
