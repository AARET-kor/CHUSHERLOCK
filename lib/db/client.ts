import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath = process.env.CODEX_DB_PATH ?? "./data/codex.sqlite";

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const sqliteClient = new Database(dbPath);
sqliteClient.pragma("journal_mode = WAL");
sqliteClient.pragma("foreign_keys = ON");
sqliteClient.pragma("busy_timeout = 5000");

export const db = drizzle(sqliteClient, { schema });
