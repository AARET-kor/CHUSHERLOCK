import { describe, expect, it } from "vitest";
import {
  applyDecorations,
  stripDecorations,
  wrapHighlight,
  wrapPen,
} from "../lib/codex/decorations";

describe("applyDecorations", () => {
  it("converts highlight markers to class-mode mark tags", () => {
    const html = applyDecorations("<p>수기는 ==yellow:24-72시간== 관찰</p>", "class");
    expect(html).toBe('<p>수기는 <mark class="hl hl-yellow">24-72시간</mark> 관찰</p>');
  });

  it("converts pen markers to class-mode span tags", () => {
    const html = applyDecorations("++red:금기++ 확인", "class");
    expect(html).toBe('<span class="pen pen-red">금기</span> 확인');
  });

  it("uses inline styles in inline mode so exports carry their colors", () => {
    const html = applyDecorations("==green:안전== ++blue:주의++", "inline");
    expect(html).toContain('style="background:#BBF7D0');
    expect(html).toContain('style="color:#2563EB');
    expect(html).not.toContain("class=");
  });

  it("handles multiple decorations in one line", () => {
    const html = applyDecorations("==pink:A== 그리고 ==blue:B==", "class");
    expect(html).toContain("hl-pink");
    expect(html).toContain("hl-blue");
    expect(html).not.toContain("==");
  });

  it("leaves unknown color names untouched", () => {
    const src = "==magenta:없는 색==";
    expect(applyDecorations(src, "class")).toBe(src);
  });

  it("leaves plain markdown emphasis untouched", () => {
    const src = "<p><strong>굵게</strong> a == b 비교</p>";
    expect(applyDecorations(src, "class")).toBe(src);
  });
});

describe("stripDecorations", () => {
  it("removes markers but keeps inner text", () => {
    expect(stripDecorations("용량은 ==yellow:0.05 mL==와 ++red:주의++")).toBe(
      "용량은 0.05 mL와 주의"
    );
  });

  it("returns undecorated text unchanged", () => {
    expect(stripDecorations("plain text == not a marker")).toBe("plain text == not a marker");
  });
});

describe("wrap helpers", () => {
  it("round-trips through applyDecorations", () => {
    const marked = `${wrapHighlight("핵심", "orange")} ${wrapPen("경고", "amber")}`;
    const html = applyDecorations(marked, "class");
    expect(html).toBe(
      '<mark class="hl hl-orange">핵심</mark> <span class="pen pen-amber">경고</span>'
    );
  });
});
