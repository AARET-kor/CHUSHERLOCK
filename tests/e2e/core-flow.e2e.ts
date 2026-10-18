import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("dashboard and quick-note flow work end to end", async ({ page }) => {
  await page.goto("/kb");
  await expect(page.getByRole("heading", { name: "COGNITIO" })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText("자료 넣기 — Drop Anything")).toBeVisible();

  await page.goto("/entries/new");
  await page.locator("textarea[autofocus]").fill(
    "E2E 근거 노트\n\n권장 용량은 10 mg이며 원문 대조 전에는 임상 적용하지 않는다."
  );
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E 근거 노트");
  await expect(page.getByText("AI/사용자 초안")).toBeVisible();
});

test("fake ingest completes and exposes provenance claims", async ({ page }) => {
  await page.goto("/kb");
  await page.getByRole("button", { name: "파일 대신 텍스트 붙여넣기" }).click();
  await page.locator('textarea[placeholder*="논문 초록"]').fill(
    "[[페이지 1]] 권장 용량은 10 mg이다. blanching 발생 시 즉시 중단한다."
  );
  await page.getByPlaceholder("출처 (필수)").fill("E2E guideline v1");
  await page.getByRole("button", { name: "AI로 읽고 분류" }).click();
  await expect(page.getByText(/정리 제안 1건/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/근거 추적 claim 1개/)).toBeVisible();
});

test("CHUNK deck builds flashcards and opens a focused review", async ({ page }) => {
  const deckTitle = `CHUNK E2E 학습 덱 ${Date.now()}`;
  await page.goto("/entries/new");
  await page.locator("textarea[autofocus]").fill(
    "CHUNK E2E 노트\n\n응급 상황의 첫 단계와 확인 항목을 순서대로 정리한다."
  );
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  const entryId = new URL(page.url()).pathname.split("/").pop();
  expect(entryId).toBeTruthy();

  const response = await page.request.post("/api/clusters", {
    data: {
      title: deckTitle,
      description: "노트에서 카드 복습까지 이어지는 핵심 흐름",
      entryIds: [entryId],
    },
  });
  const responseBody = await response.text();
  expect(
    response.ok(),
    `${response.status()}: ${responseBody}; entry=${entryId}; url=${page.url()}`
  ).toBeTruthy();

  await page.goto("/study");
  const deckHeading = page.getByRole("heading", { name: deckTitle, exact: true });
  await expect(deckHeading).toBeVisible();
  const deck = page.locator("section").filter({ has: deckHeading });
  await deck.getByRole("button", { name: /카드 준비하고 시작/ }).click();
  await expect(page).toHaveURL(/\/review\?clusterId=/);
  await expect(page.getByRole("heading", { name: `${deckTitle} 복습`, exact: true })).toBeVisible();
  await expect(page.getByText(/남은 카드 2장/)).toBeVisible();
});

test("critical pages have no serious or critical accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/kb", "/", "/entries/new", "/study"]) {
    await page.goto(route);
    // The editorial hero intentionally reveals copy in a delayed sequence;
    // audit its settled state instead of the transient fade opacity.
    await page.waitForTimeout(route === "/kb" ? 3_500 : 300);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking, `${route}: ${blocking.map((item) => item.id).join(", ")}`).toEqual([]);
  }
});
