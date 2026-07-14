import { describe, expect, it } from "vitest";
import { normalizeClusters, fakeClusterCaller } from "../lib/ai/clusters";
import { noteDigest } from "../lib/services/clusterService";

describe("normalizeClusters", () => {
  const valid = ["a", "b", "c", "d"];

  it("drops unknown ids and clusters that fall below 2 notes", () => {
    const out = normalizeClusters(
      [
        { title: "T1", description: "", suggestions: [], entryIds: ["a", "zzz", "b"] },
        { title: "T2", description: "", suggestions: [], entryIds: ["c"] }, // too small after filter
      ],
      valid
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.entryIds).toEqual(["a", "b"]);
  });

  it("prevents a note from appearing in two clusters (first wins)", () => {
    const out = normalizeClusters(
      [
        { title: "T1", description: "", suggestions: [], entryIds: ["a", "b"] },
        { title: "T2", description: "", suggestions: [], entryIds: ["b", "c", "d"] },
      ],
      valid
    );
    expect(out[0]!.entryIds).toEqual(["a", "b"]);
    expect(out[1]!.entryIds).toEqual(["c", "d"]); // b already used
  });

  it("preserves study order within a cluster", () => {
    const out = normalizeClusters(
      [{ title: "T", description: "", suggestions: [], entryIds: ["d", "a", "c"] }],
      valid
    );
    expect(out[0]!.entryIds).toEqual(["d", "a", "c"]);
  });
});

describe("noteDigest", () => {
  it("extracts the 한눈에 보기 summary when present", () => {
    const content = "> **한눈에 보기**\n> 울쎄라 이마는 1.5mm 팁.\n> 핵심 0.9-1.2J.\n\n## 본문\n긴 내용...";
    const d = noteDigest(content);
    expect(d).toContain("울쎄라 이마는 1.5mm 팁");
    expect(d).toContain("0.9-1.2J");
    expect(d).not.toContain("##");
    expect(d).not.toContain("**");
  });

  it("falls back to a stripped excerpt without a summary block", () => {
    const content = "## 제목\n**굵게** 그리고 `코드` 내용이 이어집니다.";
    const d = noteDigest(content, 40);
    expect(d).not.toContain("#");
    expect(d).not.toContain("`");
    expect(d.length).toBeLessThanOrEqual(40);
  });
});

describe("fakeClusterCaller", () => {
  it("groups notes by category label, skipping singletons", async () => {
    const clusters = await fakeClusterCaller({
      notes: [
        { id: "1", title: "A", categoryLabel: "보톡스", tier: "시술 팁", digest: "" },
        { id: "2", title: "B", categoryLabel: "보톡스", tier: "시술 팁", digest: "" },
        { id: "3", title: "C", categoryLabel: "필러", tier: "심화", digest: "" }, // singleton → skipped
      ],
    });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.entryIds).toEqual(["1", "2"]);
  });
});
