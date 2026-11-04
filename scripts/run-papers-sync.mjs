// scripts/run-papers-sync.mjs
// Asks the running BBIP server for the weekly paper sync. Node, not a shell
// script: macOS blocks launchd's /bin/sh from the Desktop folder, while the
// node binary the server agent already uses can read it. The token stays in
// .env.local and never appears in `ps` or the plist.
import fs from "node:fs";

const ATTEMPTS = 10;
const RETRY_MS = 30_000;

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const token = /^CODEX_ACCESS_TOKEN=(.*)$/m.exec(env)?.[1]?.replace(/^["']|["']$/g, "").trim() ?? "";
const headers = { "Content-Type": "application/json" };
if (token) headers.Authorization = `Bearer ${token}`;

// The server may still be starting when launchd fires this right after login.
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    const res = await fetch("http://localhost:3200/api/papers/sync", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "weekly" }),
    });
    console.log(new Date().toISOString(), res.status);
    // 409 means a sync is already running, which is fine.
    process.exit(res.ok || res.status === 409 ? 0 : 1);
  } catch (error) {
    console.error(new Date().toISOString(), `attempt ${attempt}:`, error instanceof Error ? error.message : "failed");
    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}
process.exit(1);
