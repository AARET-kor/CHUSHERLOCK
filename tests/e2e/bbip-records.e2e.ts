// tests/e2e/bbip-records.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);
const COLD = { timeout: 20_000 };
// The e2e DB persists between runs: a fresh chart number keeps runs apart.
const CHART = `E${Date.now().toString().slice(-7)}`;

async function consult(page: Page, memo: string) {
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill(memo);
  await page.getByRole("button", { name: "BBIP", exact: true }).click();
  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
}

/** Axe after finite animations (fade-ins) settle; `include` scopes it to
 * the records UI on pages that also hold older consult blocks. */
async function noBlockingA11y(page: Page, include?: string) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== "running")
  );
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, blocking.map((v) => v.id).join(", ")).toEqual([]);
}

test("consult → register → record → photos → next consult links and continues", async ({ page }) => {
  // 1. First consult with a new chart number: offered for registration.
  await consult(page, `#${CHART} 40대 여성, 기미, 피코토닝`);
  await page.getByRole("button", { name: new RegExp(`Register #${CHART}`) }).click();
  await expect(page.getByRole("link", { name: `#${CHART}` })).toBeVisible();

  // 2. Record it: a new course starting with a baseline.
  await page.getByRole("button", { name: /기록에 남기기/ }).click();
  const dialog = page.getByRole("dialog", { name: /기록에 남기기/ });
  await expect(dialog.getByLabel(/Procedure · 시술/)).toHaveValue(/피코토닝/, COLD);
  await dialog.getByLabel(/Parameters · 파라미터/).fill("1064nm 2.5J/cm²");
  await dialog.getByRole("button", { name: "Save · 저장" }).click();
  await expect(page.getByText(/기록됐습니다/)).toBeVisible();

  // 3. Drop two photos onto the recorded visit (file input path = same upload).
  await page.getByLabel("사진 파일 고르기").setInputFiles(["tests/fixtures/face-a.jpg", "tests/fixtures/face-b.jpg"]);
  await expect(page.getByRole("img", { name: /정면 사진/ })).toBeVisible(COLD);
  await expect(page.getByRole("img", { name: /좌 45° 사진/ })).toBeVisible();

  // 4. Same chart number again: linked automatically, history shown, brief reads it.
  await consult(page, `#${CHART} 40대 여성, 기미, 피코토닝 1회차`);
  await expect(page.getByRole("link", { name: `#${CHART}` })).toBeVisible();
  await expect(page.getByText("1064nm 2.5J/cm²")).toBeVisible();
  await expect(page.getByText(/이전 경과를 반영한 예시입니다/)).toBeVisible();

  // 5. Record session 1 of the same course.
  await page.getByRole("button", { name: /기록에 남기기/ }).click();
  const next = page.getByRole("dialog", { name: /기록에 남기기/ });
  await expect(next.getByRole("spinbutton", { name: /Session · 회차/ })).toHaveValue("1", COLD);
  await expect(next.getByLabel(/Parameters · 파라미터/)).toHaveValue("1064nm 2.5J/cm²");
  await next.getByRole("button", { name: "Save · 저장" }).click();
  await expect(page.getByText(/1회차 방문으로 기록됐습니다/)).toBeVisible();

  // 6. Records: find the patient by search, open the course, see the grid.
  await page.goto("/cases");
  await page.getByPlaceholder(/차트번호, 별칭/).fill(CHART);
  await page.getByRole("link", { name: new RegExp(`#${CHART}`) }).click();
  await expect(page).toHaveURL(/\/patients\/[^/]+$/, COLD);
  await page.getByRole("link", { name: /진행 중 피코토닝/ }).click();
  await expect(page).toHaveURL(/\/courses\//, COLD);
  await expect(page.getByRole("columnheader", { name: /Baseline/ })).toBeVisible(COLD);
  await expect(page.getByRole("columnheader", { name: /S1/ })).toBeVisible();
  await noBlockingA11y(page);
});

test("a case without a chart number suggests the similar patient", async ({ page }) => {
  await consult(page, `#${CHART}S 50대 남성, 사각턱, 보톡스`);
  await page.getByRole("button", { name: new RegExp(`Register #${CHART}S`) }).click();
  await consult(page, "50대 남성, 사각턱, 보톡스");
  await expect(page.getByText(/이전 환자일 수 있어요/)).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: `#${CHART}S` }).getByRole("button", { name: /Link · 연결/ }).click();
  await expect(page.getByRole("link", { name: `#${CHART}S` })).toBeVisible();
  await noBlockingA11y(page, "section[aria-labelledby='bbip-case']");
});
