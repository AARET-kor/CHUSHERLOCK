// scripts/mark-papers.ts
// Adds pen marks to analyses saved before marks existed. Their text, model and
// date stay as they are, and analyses that already have marks are skipped.
// Run: set -a; . ./.env; set +a; npx tsx scripts/mark-papers.ts
import { markUnmarked } from "../lib/papers/run";

markUnmarked()
  .then((count) => console.log(`Marked ${count} papers.`))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
