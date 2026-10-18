// tests/e2e/bbip.e2e.ts
import { expect, test } from "@playwright/test";

const CASE = "40대 여성, 기미, 아스피린 복용, 피코토닝 희망";

// The dev server compiles the BBIP API routes on first hit (and the core-flow
// file runs in a second worker), so allow cold-start headroom.
test.setTimeout(60_000);
const COLD = { timeout: 20_000 };

test("case → flags → brief → section → promote to draft note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "미용 GP 진료 비서" })).toBeVisible();

  await page.getByLabel("케이스 입력").fill(CASE);
  await expect(page.getByRole("button", { name: "BBIP", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "BBIP", exact: true }).click();

  await expect(page.getByRole("button", { name: "아스피린 삭제" })).toBeVisible(COLD);
  await expect(page.getByText(/항응고\/항혈소판제/).first()).toBeVisible(COLD);
  await expect(page.getByText("[FAKE 모드]")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /피코토닝 감별 포인트는\?/ })).toBeVisible();
  await expect(page).toHaveURL(/\/\?s=[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: /감별질환/ }).click();
  const card = page.locator("article").filter({ hasText: "감별질환 (FAKE)" });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "＋ 노트로 저장" }).click();
  const dialog = page.getByRole("dialog", { name: "노트로 저장" });
  await expect(dialog.getByLabel("제목")).not.toHaveValue("");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();

  await card.getByRole("link", { name: "✓ 노트에 저장됨" }).click();
  await expect(page).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
  await expect(page.getByText("AI/사용자 초안")).toBeVisible();
});

test("history restores a finished session", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill(CASE);
  await expect(page.getByRole("button", { name: "BBIP", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "BBIP", exact: true }).click();
  await expect(page.getByText("[FAKE 모드]")).toBeVisible({ timeout: 20_000 });
  const url = page.url();

  // "＋ 새 케이스" is a client-side navigation and must clear the screen.
  await page.getByRole("link", { name: "＋ 새 케이스" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("[FAKE 모드]")).toHaveCount(0);

  await page.goto("/");
  await page.goto(url);
  await expect(page.getByText("[FAKE 모드]")).toBeVisible();
  await expect(page.getByRole("button", { name: /피코토닝 시술 간격은\?/ })).toBeVisible();
});
