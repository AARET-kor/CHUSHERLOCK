import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("knowledge search, pin, recent visit and explicit anatomy link", async ({ page, request }) => {
  test.setTimeout(120_000);
  const title = `자료연결-${Date.now()}`;
  const created = await request.post("/api/entries", { data: { title, content: "## 핵심\n**안면동맥** 관련 원문을 확인하는 테스트 자료입니다.", categoryKey: "face-filler", tier: "deep_study", sources: [{ type: "personal_note", citation: "테스트 출처" }] } });
  expect(created.ok()).toBeTruthy();
  const { entry } = await created.json();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/kb");
    const search = page.getByRole("searchbox", { name: "필요한 지식 찾기" });
    await search.fill(title);
    await expect(page.getByRole("status")).toContainText("검색 결과 1개");
    await page.getByRole("button", { name: `${title} 고정`, exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "고정", exact: true }).click();
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: title }) }).click();
    await expect(page.getByRole("region", { name: "빠른 확인" })).toBeVisible();
    await page.getByText("전체 내용 펼치기", { exact: true }).click();
    await expect(page.locator("article").first()).toContainText("안면동맥");
    await page.getByLabel("연결할 해부 구조").selectOption("facial-artery");
    await page.getByRole("button", { name: "연결", exact: true }).click();
    await expect(page.getByRole("button", { name: "안면동맥 연결 해제" })).toBeVisible();
    const linked = await request.get("/api/anatomy/facial-artery/notes");
    expect((await linked.json()).notes.some((n: { id: string }) => n.id === entry.id)).toBe(true);
    await page.goto("/kb");
    await page.getByRole("button", { name: "최근 열람", exact: true }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const a11y = await new AxeBuilder({ page }).include("#knowledge-notes").analyze();
    expect(a11y.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    await page.screenshot({ path: "test-results/knowledge-home-mobile.png", fullPage: true });
  } finally { await request.delete(`/api/entries/${entry.id}`); }
});
