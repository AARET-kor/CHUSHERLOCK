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
  const chip = page.locator("button.atlas-ref").first();
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

test("explorer connects search, depth, zoom and cross-region navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCase(page, "팔자 필러");
  const card = page.locator("section[aria-labelledby='bbip-anatomy']");
  await expect(card.getByRole("heading", { name: "해부 지도" })).toBeVisible(COLD);
  const map = card.locator("svg.atlas-svg");

  await card.getByRole("button", { name: /시각적 설명/ }).click();
  await expect(card.getByRole("button", { name: /얼굴 전체/ })).toHaveAttribute("aria-pressed", "true");
  await expect(map).not.toHaveAttribute("viewBox", "0 0 240 300");
  await card.getByRole("tab", { name: /측면/ }).click();
  await expect(map).not.toHaveAttribute("viewBox", "0 0 240 300");
  await card.getByRole("button", { name: /자세히 탐색/ }).click();
  await expect(map).toHaveAttribute("viewBox", "0 0 240 300");
  await expect(card.getByRole("group", { name: "레이어", exact: true }).getByRole("button", { name: /근육/ })).toHaveAttribute("aria-pressed", "true");

  await card.getByRole("group", { name: "깊이 탐색", exact: true }).getByRole("button", { name: /골막/ }).click();
  await expect(map.locator("[data-structure='angular-artery']")).toHaveCount(0);
  await expect(card.getByText("현재 부위·층·레이어 조합에 표시할 구조물이 없습니다.", { exact: false })).toBeVisible();

  await card.getByLabel("해부 구조물 검색").fill("각동맥");
  await card.getByRole("region", { name: "구조물 검색 결과" }).getByRole("button", { name: /각동맥/ }).click();
  await expect(card.getByRole("group", { name: "깊이 탐색", exact: true }).getByRole("button", { name: /모든 층/ })).toHaveAttribute("aria-pressed", "true");
  await expect(map.locator("[data-structure='angular-artery']")).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("heading", { name: /Nasolabial\s*팔자/ })).toBeVisible();

  await card.getByLabel("해부 구조물 검색").fill("masseter");
  await card.getByRole("region", { name: "구조물 검색 결과" }).getByRole("button", { name: /교근/ }).click();
  await expect(card.getByLabel("다른 부위 탐색")).toHaveValue("chin-jawline");
  await expect(map.locator("[data-structure='masseter']")).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("heading", { name: "Masseter", exact: true })).toBeVisible();
  await expect(card.getByText("이 부위에서 같은 층을 지나는 구조", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page }).include("section[aria-labelledby='bbip-anatomy']").analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("mobile botox case maps the named muscle and can expand to all anatomy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCase(page, "교근 보톡스");
  const card = page.locator("section[aria-labelledby='bbip-anatomy']");
  await expect(card.getByLabel("다른 부위 탐색")).toHaveValue("chin-jawline", COLD);
  await expect(card.locator("svg.atlas-svg [data-structure='masseter']")).toBeVisible();
  await card.getByRole("button", { name: /자세히 탐색/ }).click();
  await expect(card.locator("svg.atlas-svg [data-structure='facial-artery']")).toBeVisible();
  await card.getByRole("button", { name: /진료 확인/ }).click();
  await expect(card.locator("svg.atlas-svg [data-structure='facial-artery']")).toHaveCount(0);
  await expect(card.getByLabel("해부 구조물 검색")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
