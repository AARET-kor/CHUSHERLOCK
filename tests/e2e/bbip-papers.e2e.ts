// tests/e2e/bbip-papers.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(120_000);
const COLD = { timeout: 20_000 };

test("collect → list by IF → analyze → review → cite in a brief → exclude", async ({ page }) => {
  // 1. Collect (fake ids are new on every run; the e2e DB persists).
  await page.goto("/papers");
  await expect(page.getByRole("heading", { name: /미용 논문/ })).toBeVisible(COLD);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/papers/sync") && r.request().method() === "POST", COLD),
    page.getByRole("button", { name: /Sync now/ }).click(),
  ]);
  await expect
    .poll(async () => (await (await page.request.get("/api/papers/sync")).json()).run?.finishedAt, COLD)
    .toBeTruthy();

  // 2. Listed with an IF; the newest fake paper tops its equal-IF group.
  await page.goto("/papers?topic=filler&analysis=unanalyzed");
  const row = page.getByRole("listitem").filter({ hasText: "[FAKE] Hyaluronidase" }).first();
  await expect(row).toContainText("IF ≈");
  const title = (await row.getByRole("link").first().textContent())!;

  // 3. Analyze once; the button is gone afterwards, so it cannot run twice.
  await row.getByRole("button", { name: /Analyze/ }).click();
  // Refreshing moves it out of this unanalyzed list once the analysis is saved.
  await expect(page.getByRole("link", { name: title })).toHaveCount(0, COLD);
  await page.goto("/papers?topic=filler&analysis=analyzed");
  await page.getByRole("link", { name: title }).first().click();
  await expect(page).toHaveURL(/\/papers\/\d+$/, COLD);
  await expect(page.getByRole("heading", { name: /Limitations/ })).toBeVisible(COLD);
  await expect(page.locator("blockquote").getByText("A key limitation of this study")).toBeVisible();
  await expect(page.getByText("인용 확인 안 됨")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Analyze/ })).toHaveCount(0);
  const paperUrl = page.url();

  // 4. A filler consult cites a library paper, labelled as an unreviewed AI analysis.
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill("50대 여성, 팔자 필러 용해 상담");
  await page.getByRole("button", { name: "BBIP", exact: true }).click();
  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
  await expect(page.getByText(/AI 분석·미검토/).first()).toBeVisible(COLD);

  // 5. Review and exclude on the paper page; axe on all three screens.
  await page.goto(paperUrl);
  await page.getByRole("button", { name: /Reviewed/ }).click();
  await expect(page.getByRole("button", { name: /Reviewed/ })).toHaveAttribute("aria-pressed", "true", COLD);
  const results = await new AxeBuilder({ page }).include("article").analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: /Excluded/ }).click();
  await expect(page.getByRole("button", { name: /Excluded/ })).toHaveAttribute("aria-pressed", "true", COLD);

  // 6. The journal table saves an edit.
  await page.goto("/papers/journals");
  const input = page.getByLabel("Aesthetic Surgery Journal IF", { exact: true });
  await expect(input).toBeVisible(COLD);
  const original = await input.inputValue();
  await input.fill("3.3");
  await input.blur();
  await expect(page.getByText("Saved · 저장됨")).toBeVisible(COLD);
  await input.fill(original);
  await input.blur();
  const table = await new AxeBuilder({ page }).include("table").analyze();
  expect(table.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("the list page has no serious accessibility issues", async ({ page }) => {
  await page.goto("/papers");
  await expect(page.getByRole("heading", { name: /미용 논문/ })).toBeVisible(COLD);
  // Fade-ins would otherwise be measured half way through.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== "running")
  );
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 120)} ${n.any[0]?.message ?? ""}`));
  expect(blocking).toEqual([]);
});
