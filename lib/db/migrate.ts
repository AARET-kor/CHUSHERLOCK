import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import { categories } from "./schema";
import { CATEGORY_TAXONOMY } from "../codex/taxonomy";

migrate(db, { migrationsFolder: "./drizzle" });

for (const category of CATEGORY_TAXONOMY) {
  db.insert(categories)
    .values(category)
    .onConflictDoUpdate({
      target: categories.key,
      set: {
        labelKo: category.labelKo,
        labelEn: category.labelEn,
        parentKey: category.parentKey,
        descriptionKo: category.descriptionKo,
        descriptionEn: category.descriptionEn,
      },
    })
    .run();
}

console.log(`Migrated schema and seeded ${CATEGORY_TAXONOMY.length} categories.`);
