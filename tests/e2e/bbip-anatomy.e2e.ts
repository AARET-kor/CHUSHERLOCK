// tests/e2e/bbip-anatomy.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Cold dev-server compiles on first hit (see bbip.e2e.ts).
test.setTimeout(60_000);
const COLD = { timeout: 20_000 };

async function openCase(page: Page, input: string) {
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill(input);
  await expect(page.getByRole("button", { name: "BBIP", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "BBIP", exact: true }).click();
}

test("filler case shows the anatomy map instantly and atlas chips focus structures", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCase(page, "50대 여성, 팔자주름, 팔자 필러 희망");

  const card = page.locator("section[aria-labelledby='bbip-anatomy']");
  await expect(card.getByRole("heading", { name: "해부 지도" })).toBeVisible(COLD);
  await expect(card.getByRole("tab", { name: "정면" })).toHaveAttribute("aria-selected", "true");
  await expect(card.getByRole("cell", { name: /안면동맥/ }).first()).toBeVisible();
  await expect(card.getByText("원장 검토 전 초안").first()).toBeVisible();

  await card.getByRole("tab", { name: "측면" }).click();
  await expect(card.getByRole("tab", { name: "측면" })).toHaveAttribute("aria-selected", "true");

  // The fake brief cites one atlas structure as {{atlas:id}} → chip.
  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
  const chip = page.locator("button.ev-atlas").first();
  const id = await chip.getAttribute("data-atlas");
  expect(id).toBeTruthy();
  await chip.click();
  await expect(card.locator(`svg [data-structure='${id}']`)).toHaveAttribute("aria-pressed", "true");

  const results = await new AxeBuilder({ page }).include("section[aria-labelledby='bbip-anatomy']").analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, blocking.map((v) => v.id).join(", ")).toEqual([]);
});

test("non-injection case has no anatomy map", async ({ page }) => {
  await openCase(page, "40대 여성, 기미, 피코토닝 희망");
  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
  await expect(page.locator("section[aria-labelledby='bbip-anatomy']")).toHaveCount(0);
});
