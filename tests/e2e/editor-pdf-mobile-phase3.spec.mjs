import { expect, test } from "@playwright/test";

const adminUser = {
  name: "E2E Admin",
  email: "e2e.admin@example.com",
  password: "testpass123",
};

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

function uniqueValue(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function registerOrLogin(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /初期管理者登録|ログイン \/ 利用申請/ })).toBeVisible();
  const initialAdminButton = page.getByRole("button", { name: "初期管理者を登録する" });
  if (await initialAdminButton.isVisible().catch(() => false)) {
    const registerPasswords = page.locator('section[aria-label="ユーザー登録"] input[type="password"]');
    await page.getByLabel("ユーザー名（フルネーム）").fill(adminUser.name);
    await page.getByLabel("メールアドレス").fill(adminUser.email);
    await registerPasswords.nth(0).fill(adminUser.password);
    await registerPasswords.nth(1).fill(adminUser.password);
    await initialAdminButton.click();
    await page.waitForURL("**/menu");
    return;
  }

  await page.getByRole("tab", { name: "登録済みの方" }).click();
  await page.locator('section[aria-label="登録済みユーザー"]').getByLabel("メールアドレス").fill(adminUser.email);
  await page.locator('section[aria-label="登録済みユーザー"] input[type="password"]').fill(adminUser.password);
  await page.getByRole("button", { name: "ログインして続行" }).click();
  await page.waitForURL("**/menu");
}

async function openEditor(page) {
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "施工計画書自動発行ツール" })).toBeVisible();
  await expect(page.locator('section[aria-label="保存状態"]')).toBeVisible();
}

async function createProjectInEditor(page) {
  await page.getByRole("button", { name: "新規案件" }).click();
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toBeVisible();
}

async function fillCoreFields(page, propertyName) {
  await page.locator('#card-pdf1 input[data-required-key="propertyName"]').fill(propertyName);
  await page.locator('#card-pdf1 input[data-required-key="coverRecipientSuffix"]').fill("管理組合御中");
  await page.locator('#card-pdf1 input[data-required-key="titleSubject"]').fill("高圧設備更新工事");
  await page.locator('#card-pdf3 input[data-required-key="propertyAddress"]').fill("東京都千代田区1-1-1");
  await page.locator('#card-pdf3 input[data-required-key="workDateStart"]').fill("2026-06-01");
  await page.locator('#card-pdf3 input[data-required-key="workDateEnd"]').fill("2026-06-02");
  await page.locator('#card-pdf3 input[data-required-key="outageDateStart"]').fill("2026-06-01");
  await page.locator('#card-pdf3 input[data-required-key="outageDateEnd"]').fill("2026-06-01");
  await page.locator('#card-pdf3 input[data-required-key="outageTimeStart"]').fill("09:00");
  await page.locator('#card-pdf3 input[data-required-key="outageTimeEnd"]').fill("12:00");
}

async function fillScheduleRows(page, count) {
  const addButton = page.locator("#card-pdf3").getByRole("button", { name: /行追加/ }).first();
  for (let index = 0; index < count; index += 1) {
    await addButton.click();
  }

  const rows = page.locator("#card-pdf3 .timeline-edit-table tbody tr");
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index + 1);
    await row.locator("input").first().fill(`工程${String(index + 1).padStart(2, "0")}`);
  }
}

async function uploadRequiredImages(page) {
  await page.locator('#card-pdf4 input[type="file"]').first().setInputFiles({
    name: "detail-photo.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(page.locator("#card-pdf4 .upload-dropzone.is-filled").first()).toBeVisible({ timeout: 15_000 });

  await page.locator('#card-pdf7 input[type="file"]').first().setInputFiles({
    name: "layout.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(page.locator("#card-pdf7 .upload-dropzone.is-filled").first()).toBeVisible({ timeout: 15_000 });
}

async function fillRelatedPartyCompanies(page) {
  const companyInputs = page.locator('#card-pdf6 input[data-required-key^="relatedPartyCompany:"]');
  const visibleCount = await companyInputs.count();
  for (let index = 0; index < visibleCount; index += 1) {
    const input = companyInputs.nth(index);
    if (await input.isVisible()) {
      const value = await input.inputValue();
      if (!value.trim()) {
        await input.fill(`関係会社${index + 1}`);
      }
    }
  }
  await page.locator("#card-pdf6").getByRole("button", { name: /次のスライド/ }).click();
  const nextCompanyInputs = page.locator('#card-pdf6 input[data-required-key^="relatedPartyCompany:"]');
  const nextCount = await nextCompanyInputs.count();
  for (let index = 0; index < nextCount; index += 1) {
    const input = nextCompanyInputs.nth(index);
    if (await input.isVisible()) {
      const value = await input.inputValue();
      if (!value.trim()) {
        await input.fill(`関係会社${index + 3}`);
      }
    }
  }
}

async function addApprovalTemplateRows(page) {
  const addApprovalButton = page.locator("#card-pdf5").getByRole("button", { name: /行を追加/ });
  await addApprovalButton.click();
  await addApprovalButton.click();

  const approvalRows = page.locator("#card-pdf5 .approval-request-row");
  await approvalRows.nth(0).locator("select").selectOption("approval_plant_excavation_no_compensation");
  await approvalRows.nth(1).locator("select").selectOption("approval_alternating_one_way_traffic");
  await approvalRows.nth(1).locator("textarea").fill("図示Aの区間は、作業車が道路の一部を占有するため、片側交互通行となります。現場確認済みの編集文です。");
}

async function expectNoHorizontalOverflow(page) {
  const offenders = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const htmlElement = element;
        if (htmlElement.closest('[aria-hidden="true"]')) {
          return false;
        }
        if (htmlElement.closest(".mobile-workflow-switcher, .table-wrap, .timeline-wrap, .preview-timeline, .csv-virtual-wrap")) {
          return false;
        }
        const style = window.getComputedStyle(htmlElement);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
          return false;
        }
        const rect = htmlElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.getAttribute("class") || ""),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          viewportWidth,
        };
      });
  });
  expect(offenders).toEqual([]);
}

test("PDF continuation pages and approval templates are present in print output", async ({ page }) => {
  const propertyName = uniqueValue("PDF続き確認物件");

  await registerOrLogin(page);
  await openEditor(page);
  await createProjectInEditor(page);
  await fillCoreFields(page, propertyName);
  await fillScheduleRows(page, 16);
  await uploadRequiredImages(page);
  await fillRelatedPartyCompanies(page);
  await addApprovalTemplateRows(page);

  await page.evaluate(() => {
    window.print = () => {
      window.__sekouE2ePrintCalled = true;
    };
  });

  await expect(page.locator(".bottom-bar-pdf-action")).toBeEnabled({ timeout: 30_000 });
  await page.locator(".bottom-bar-pdf-action").click();
  const printArea = page.locator(".print-only");
  await expect(printArea).toContainText("工事概要（工程表続き）", { timeout: 2_000 });
  await expect(printArea).toContainText("工事詳細説明（作業詳細続き）");
  await expect(printArea).toContainText("ご承認いただきたい事項（工程表続き）");
  await expect(printArea).toContainText("■ 植栽部の掘削・補償について");
  await expect(printArea).toContainText("現場確認済みの編集文です。");
  await expect.poll(() => page.evaluate(() => Boolean(window.__sekouE2ePrintCalled))).toBe(true);
});

test("iPhone width keeps editor cards inside viewport and prioritizes primary actions", async ({ page }) => {
  const propertyName = uniqueValue("iPhone確認物件");

  await registerOrLogin(page);
  await openEditor(page);
  await createProjectInEditor(page);
  await fillCoreFields(page, propertyName);
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.locator(".mobile-workflow-switcher")).toBeVisible();
  await expect(page.locator(".mobile-step-footer")).toBeVisible();
  await expect(page.locator(".bottom-bar-pdf-action")).toBeVisible();
  await expect(page.locator(".bottom-bar-pdf-action")).toHaveCSS("order", "-2");
  await expect(page.locator(".bottom-bar-secondary-actions")).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/editor-iphone-phase3.png", fullPage: true });
});
