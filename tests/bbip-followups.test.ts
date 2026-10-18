// tests/bbip-followups.test.ts
import { describe, expect, it } from "vitest";
import { FollowupExtractor, parseFollowups } from "../lib/bbip/followups";

function run(chunks: string[]) {
  const extractor = new FollowupExtractor();
  let visible = "";
  for (const chunk of chunks) visible += extractor.push(chunk);
  const finished = extractor.finish();
  return { visible: visible + finished.tail, followups: finished.followups };
}

describe("FollowupExtractor", () => {
  it("strips a tag split across chunks", () => {
    const result = run(["본문 <foll", 'owups>["a","b"]</follo', "wups>"]);
    expect(result.visible).toBe("본문 ");
    expect(result.followups).toEqual(["a", "b"]);
  });

  it("releases a held '<' that turns out not to be the tag", () => {
    const result = run(["x <", " y"]);
    expect(result.visible).toBe("x < y");
    expect(result.followups).toEqual([]);
  });

  it("passes text through when there is no tag", () => {
    expect(run(["가나", "다"]).visible).toBe("가나다");
  });
});

describe("parseFollowups", () => {
  it("accepts a bullet list fallback", () => {
    expect(parseFollowups("- q1\n- q2")).toEqual(["q1", "q2"]);
  });

  it("strips a code fence around the JSON", () => {
    expect(parseFollowups('```json\n["a","b"]\n```')).toEqual(["a", "b"]);
  });

  it("recovers a truncated JSON array", () => {
    expect(parseFollowups('["a","b"')).toEqual(["a", "b"]);
  });

  it("caps at four and trims long items", () => {
    const items = parseFollowups(JSON.stringify(["1", "2", "3", "4", "5", "x".repeat(200)]));
    expect(items).toEqual(["1", "2", "3", "4"]);
    expect(parseFollowups(JSON.stringify(["y".repeat(200)]))[0]!.length).toBe(80);
  });
});
