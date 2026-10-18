// tests/bbip-schema.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTempDb } from "./helpers/tempDb";

let env: Awaited<ReturnType<typeof setupTempDb>>;

beforeAll(async () => {
  env = await setupTempDb("bbip-schema");
});
afterAll(() => env.cleanup());

function columns(table: string): string[] {
  return (env.sqliteClient.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (c) => c.name
  );
}

describe("bbip tables", () => {
  it("creates bbip_sessions without any raw-input column", () => {
    const cols = columns("bbip_sessions");
    expect(cols).toEqual(
      expect.arrayContaining(["id", "chips", "flags", "source_note_ids", "prompt_version", "created_at"])
    );
    expect(cols.some((c) => /input|memo|raw/.test(c))).toBe(false);
  });

  it("creates bbip_turns", () => {
    expect(columns("bbip_turns")).toEqual(
      expect.arrayContaining([
        "id", "session_id", "kind", "section_key", "question", "output", "followups",
        "model", "status", "error", "promoted_entry_id", "created_at",
      ])
    );
  });
});
