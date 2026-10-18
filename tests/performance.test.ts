import { describe, expect, it } from "vitest";
import { chunkDocument } from "../lib/ingest/chunk";
import { retrieve } from "../lib/ai/retrieval";
import type { CodexEntry } from "../lib/codex/types";

describe("large-input performance guards", () => {
  it("chunks a multi-megabyte document within a bounded time", () => {
    const document = Array.from(
      { length: 4_000 },
      (_, index) => `## Section ${index}\n${"임상 내용과 수치 10 mg. ".repeat(30)}`
    ).join("\n\n");
    const started = performance.now();
    const chunks = chunkDocument(document);
    const elapsed = performance.now() - started;
    expect(chunks.length).toBeGreaterThan(50);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("retrieves from 5,000 notes within a bounded time", () => {
    const entries: CodexEntry[] = Array.from({ length: 5_000 }, (_, index) => ({
      id: `entry-${index}`,
      title: index === 4_321 ? "혈관 폐색 hyaluronidase 응급 프로토콜" : `일반 노트 ${index}`,
      content:
        index === 4_321
          ? "vascular occlusion 발생 시 hyaluronidase 고용량 응급 처치"
          : "일반적인 임상 학습 내용",
      categoryKey: "test",
      tier: "deep_study",
      tags: [],
      sources: [],
      relatedEntryIds: [],
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      contentVersion: 1,
      claims: [],
    }));
    const started = performance.now();
    const result = retrieve("혈관 폐색 hyaluronidase", entries, 16);
    const elapsed = performance.now() - started;
    expect(result[0]!.note.id).toBe("entry-4321");
    expect(elapsed).toBeLessThan(5_000);
  });
});
