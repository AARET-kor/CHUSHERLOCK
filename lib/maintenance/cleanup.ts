import { cleanupOrphanStorage } from "./storage";

const apply = process.argv.includes("--apply");
const report = cleanupOrphanStorage({ dryRun: !apply });

console.log(JSON.stringify(report, null, 2));
if (!apply) {
  console.log("Dry run only. Use `npm run db:cleanup -- --apply` to remove these orphans.");
}
