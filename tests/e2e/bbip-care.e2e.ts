// tests/e2e/bbip-care.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Cold dev-server compiles on first hit (see bbip.e2e.ts).
test.setTimeout(90_000);
const COLD = { timeout: 20_000 };

// The e2e DB persists between runs; a unique procedure keeps saved sets from
// earlier runs out of this one. "시술" makes the fake parser read it as a procedure.
const PROCEDURE = `케어시술${Date.now().toString(36)}`;

async function openCase(page: Page, memo: string) {
  await page.goto("/");
  await page.getByLabel("케이스 입력").fill(memo);
  await expect(page.getByRole("button", { name: "BBIP", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "BBIP", exact: true }).click();
  await expect(page.getByText("[FAKE 모드]")).toBeVisible(COLD);
}

test("care orders: confirm rows, copy the EMR order, print the handout, reuse my set", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openCase(page, `40대 여성, 기미, 아스피린 복용, ${PROCEDURE} 희망`);

  await page.getByRole("button", { name: /처방·드레싱·F\/U/ }).click();
  const care = page.getByRole("region", { name: "처방·F/U" });
  await expect(care.getByText(/\[FAKE\] 재생크림/)).toBeVisible(COLD);
  await expect(care.getByText("AI 제안 수치 — 확인 필요").first()).toBeVisible();

  const copy = care.getByRole("button", { name: "EMR 오더 복사" });
  await expect(copy).toBeDisabled();
  for (const box of await care.getByRole("checkbox").all()) await box.check();
  await expect(care.getByText("4/4행 확인")).toBeVisible();
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect(care.getByText("복사했습니다")).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("[처방]");
  expect(clipboard).toContain("mupirocin");

  const results = await new AxeBuilder({ page }).include("section[aria-labelledby='bbip-care']").analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, blocking.map((v) => v.id).join(", ")).toEqual([]);

  const [handout] = await Promise.all([
    context.waitForEvent("page"),
    care.getByRole("link", { name: "환자 안내문" }).click(),
  ]);
  await expect(handout.getByRole("heading", { name: "시술 후 안내" })).toBeVisible(COLD);
  await expect(handout.getByText(/바로 병원으로 연락하세요/)).toBeVisible();
  // Checks come from the field; the patient sentence only follows it.
  await expect(handout.getByText(/\d+월 \d+일\(.\) — 홍반·색소 확인\. 경과를 확인합니다/)).toBeVisible();
  await handout.close();

  await care.getByRole("button", { name: "내 세트로 저장" }).click();
  await expect(care.getByText(`‘${PROCEDURE}’ 세트로 저장했습니다.`)).toBeVisible();

  // Same procedure, new case: the order starts from the saved set, already confirmed.
  await openCase(page, `30대 여성, 기미, ${PROCEDURE} 희망`);
  await page.getByRole("button", { name: /처방·드레싱·F\/U/ }).click();
  const next = page.getByRole("region", { name: "처방·F/U" });
  await expect(next.getByText("내 세트").first()).toBeVisible(COLD);
  await expect(next.getByText("4/4행 확인")).toBeVisible();
  await expect(next.getByRole("button", { name: "EMR 오더 복사" })).toBeEnabled();

  await page.goto("/care-sets");
  await expect(page.getByRole("heading", { name: PROCEDURE })).toBeVisible();
});
