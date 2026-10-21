// scripts/set-access-token.mjs
// Writes a fresh random CODEX_ACCESS_TOKEN into .env.local and prints it
// once. Run it yourself in a terminal: the value is your BBIP password
// (any username works in the browser prompt). Then restart the server:
//   scripts/restart-bbip.sh
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const file = ".env.local";
const token = randomBytes(18).toString("base64url");
const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
const kept = lines.filter((line) => !line.startsWith("CODEX_ACCESS_TOKEN="));
while (kept.length && kept.at(-1) === "") kept.pop();
fs.writeFileSync(file, [...kept, `CODEX_ACCESS_TOKEN=${token}`, ""].join("\n"), { mode: 0o600 });
console.log("BBIP 접근 비밀번호 (브라우저가 물으면 아이디는 아무거나, 비밀번호는 아래 값):");
console.log(token);
