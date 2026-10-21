import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  CODEX_DB_PATH:
    process.env.CODEX_E2E_DB_PATH ?? path.resolve("data/codex-e2e.sqlite"),
  CODEX_FIGURES_DIR:
    process.env.CODEX_E2E_FIGURES_DIR ?? path.resolve("data/e2e-figures"),
  CODEX_INGEST_PAYLOAD_DIR:
    process.env.CODEX_E2E_INGEST_DIR ?? path.resolve("data/e2e-ingest"),
  CODEX_AI_MODE: "fake",
  CODEX_ACCESS_TOKEN: "e2e-access-token",
  CODEX_PHOTOS_DIR: process.env.CODEX_E2E_PHOTOS_DIR ?? path.resolve("data/e2e-photos"),
  // Own build dir so a running `npm run dev` keeps its compiled chunks.
  NEXT_DIST_DIR: ".next-e2e",
};

const migration = spawnSync(npmCommand, ["run", "db:migrate"], {
  env,
  stdio: "inherit",
});
if (migration.status !== 0) process.exit(migration.status ?? 1);

const server = spawn(npmCommand, ["run", "dev", "--", "--port", "3100"], {
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
