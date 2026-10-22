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

  // 2. Linking records the consult at once (baseline of a new course); edit it.
  await expect(page.getByText(/시작 전 방문으로 기록됐습니다/)).toBeVisible(COLD);
  await page.getByRole("button", { name: /기록 수정/ }).click();
  const dialog = page.getByRole("dialog", { name: /기록 수정/ });
  await expect(dialog.getByLabel(/Parameters · 파라미터/)).toBeVisible(COLD);
  await dialog.getByLabel(/Parameters · 파라미터/).fill("1064nm 2.5J/cm²");
  await dialog.getByRole("button", { name: "Save · 저장" }).click();
  await expect(dialog).toHaveCount(0, COLD);

  // 3. Drop two photos onto the recorded visit (file input path = same upload).
  await page.getByLabel("사진 파일 고르기").setInputFiles(["tests/fixtures/face-a.jpg", "tests/fixtures/face-b.jpg"]);
  await expect(page.getByRole("img", { name: /정면 사진/ })).toBeVisible(COLD);
  await expect(page.getByRole("img", { name: /좌 45° 사진/ })).toBeVisible();

  // 4. Same chart number again: linked automatically, history shown, brief reads it.
  await consult(page, `#${CHART} 40대 여성, 기미, 피코토닝 1회차`);
  await expect(page.getByRole("link", { name: `#${CHART}` })).toBeVisible();
  await expect(page.getByText("1064nm 2.5J/cm²")).toBeVisible();
  await expect(page.getByText(/이전 경과를 반영한 예시입니다/)).toBeVisible();

  // 5. Already recorded as session 1 of the same course, parameters carried over.
  await expect(page.getByText(/1회차 방문으로 기록됐습니다/)).toBeVisible(COLD);
  await page.getByRole("button", { name: /기록 수정/ }).click();
  const next = page.getByRole("dialog", { name: /기록 수정/ });
  await expect(next.getByRole("spinbutton", { name: /Session · 회차/ })).toHaveValue("1", COLD);
  await expect(next.getByLabel(/Parameters · 파라미터/)).toHaveValue("1064nm 2.5J/cm²");
  await next.getByLabel("GAIS · 원장").selectOption("2");
  await next.getByRole("button", { name: "Save · 저장" }).click();
  await expect(next).toHaveCount(0, COLD);
  await page.getByLabel("사진 파일 고르기").setInputFiles(["tests/fixtures/face-a.jpg", "tests/fixtures/face-b.jpg"]);
  await expect(page.getByRole("img", { name: /정면 사진/ })).toBeVisible(COLD);

  // 6. Records: find the patient by search, open the course, see the grid.
  await page.goto("/cases");
  await page.getByPlaceholder(/차트번호, 별칭/).fill(CHART);
  await page.getByRole("link", { name: new RegExp(`#${CHART}`) }).click();
  await expect(page).toHaveURL(/\/patients\/[^/]+$/, COLD);
  await page.getByRole("link", { name: /진행 중 피코토닝/ }).click();
  await expect(page).toHaveURL(/\/courses\//, COLD);
  await expect(page.getByRole("columnheader", { name: /Baseline/ })).toBeVisible(COLD);
  await expect(page.getByRole("columnheader", { name: /S1/ })).toBeVisible();
  // The key brief of each consult is kept as the visit's result.
  await expect(page.getByText("Consult result · 진료 결과").first()).toBeVisible();
  await page.getByText("Consult result · 진료 결과").first().click();
  await expect(page.getByText(/핵심 브리핑 예시입니다/).first()).toBeVisible();

  // 7. Progress chart, photo comparison and the AI change analysis.
  await expect(page.getByRole("group", { name: "GAIS 경과 그래프" })).toBeVisible();
  await page.getByText("Table view · 표로 보기").click();
  await expect(page.getByRole("cell", { name: "2 많이 좋아짐" })).toBeVisible();
  const compare = page.locator("section[aria-labelledby='course-compare']");
  await expect(compare.getByRole("img", { name: /Baseline ·/ })).toBeVisible();
  await expect(compare.getByRole("img", { name: /S1 ·/ })).toBeVisible();
  await compare.getByRole("button", { name: /Slider · 슬라이더/ }).click();
  await expect(compare.getByLabel(/비교 슬라이더/)).toBeVisible();
  await compare.getByRole("button", { name: /AI 변화 분석/ }).click();
  await expect(compare.getByText("이 사진 2장과 아래 정보가 Claude로 전송됩니다.")).toBeVisible();
  await expect(compare.getByText(/시술: 피코토닝/)).toBeVisible();
  await expect(compare.getByText(CHART)).toHaveCount(0);
  await compare.getByRole("button", { name: "Send · 보내기" }).click();
  await expect(compare.getByText(/\[FAKE\] 이전보다 색소가 옅어진/).first()).toBeVisible(COLD);
  await compare.getByRole("button", { name: /메모에 합치기/ }).click();
  await expect(page.getByText(/\[AI 변화 분석 초안\]/)).toBeVisible(COLD);
  await expect(compare.getByRole("button", { name: "메모에 반영됨" })).toBeDisabled();
  await compare.getByText("확대 · 위치 맞추기", { exact: true }).click();
  await compare.getByRole("slider", { name: "이전 확대", exact: true }).fill("1.5");
  await compare.getByRole("button", { name: "위치·확대 초기화" }).click();
  await expect(compare.getByRole("slider", { name: "이전 확대", exact: true })).toHaveValue("1");
  await compare.getByText("분석 이력 (1)", { exact: true }).click();
  await expect(compare.getByText("분석 당시 정보")).toBeVisible();
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
