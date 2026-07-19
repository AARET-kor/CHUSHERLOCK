import { describe, expect, it } from "vitest";
import {
  buildFlashcardPrompt,
  fakeFlashcardCaller,
  anthropicFlashcardCaller,
} from "../lib/ai/flashcards";

describe("flashcard generation", () => {
  it("prompt includes the note title and content, strips decoration markers", () => {
    const p = buildFlashcardPrompt({
      title: "보톡스 이마",
      content: "용량은 ==yellow:4-6 U==, ++red:주의++ brow ptosis",
    });
    expect(p).toContain("보톡스 이마");
    expect(p).toContain("4-6 U");
    expect(p).not.toContain("==yellow:"); // decoration markers stripped
    expect(p).not.toContain("++red:");
  });

  it("fake caller returns non-empty front/back cards deterministically", async () => {
    const cards = await fakeFlashcardCaller({
      title: "필러 VO 응급",
      content: "hyaluronidase 200-300 IU 국소 주입",
    });
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.front.length).toBeGreaterThan(0);
      expect(c.back.length).toBeGreaterThan(0);
    }
    expect(cards[0]!.back).toContain("hyaluronidase");
  });

  it("exports an anthropic caller for real-mode use", () => {
    expect(typeof anthropicFlashcardCaller).toBe("function");
  });
});
