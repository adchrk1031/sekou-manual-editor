import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const adminUser = {
  name: "E2E Admin",
  email: "e2e.admin@example.com",
  password: "testpass123",
};

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

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

async function openCsv(page) {
  await page.goto("/csv");
  await expect(page.getByRole("heading", { name: "CSV編集スペース" })).toBeVisible();
  await expect(page.locator(".status-summary-panel").filter({ hasText: "保存状態" })).toBeVisible();
}

async function importCsv(page, csvText, filename = "roundtrip.csv") {
  await importCsvBuffer(page, Buffer.from(`\uFEFF${csvText}`), filename);
}

async function importCsvBuffer(page, buffer, filename = "roundtrip.csv") {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText("CSV取込").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: filename,
    mimeType: "text/csv",
    buffer,
  });
  await expect(page.getByText(/CSV編集スペースへ取り込みました/)).toBeVisible({ timeout: 15_000 });
}

async function expectCsvSaved(page) {
  await expect.poll(async () => {
    const text = (await page.locator(".status-summary-panel").filter({ hasText: "保存状態" }).textContent()) ?? "";
    return /端末保存（CSV）.*CSV保存済み/.test(text.replace(/\s+/g, " "));
  }, { timeout: 30_000 }).toBe(true);
}

async function expectSharedSynced(page) {
  await expect.poll(async () => {
    const text = (await page.locator(".status-summary-panel").filter({ hasText: "保存状態" }).textContent()) ?? "";
    return /共有同期.*同期済み/.test(text.replace(/\s+/g, " "));
  }, { timeout: 30_000 }).toBe(true);
}

async function downloadText(download) {
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFile(path, "utf8");
}

test("CSV import, edit, delete, CSV roundtrip and Excel export keep business data stable", async ({ page }) => {
  const projectA = uniqueValue("CSV-A");
  const projectB = uniqueValue("CSV-B");
  const projectC = uniqueValue("CSV-C");
  const editedName = `${projectB}-編集後`;
  const csvText = [
    "project_id,property_name,title_subject,note_special",
    `${projectA},物件A,\"停電,点検\",\"引用\"\"メモ\"`,
    `${projectB},物件B,設備改修,初期メモ`,
    `${projectC},物件C,UGS交換,削除対象`,
  ].join("\n");

  await registerOrLogin(page);
  await openCsv(page);
  await importCsv(page, csvText);
  await expectCsvSaved(page);

  await expect(page.locator(".csv-cell-input").nth(0)).toHaveValue(projectA);
  await expect(page.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);
  await expect(page.locator(".csv-cell-input").nth(8)).toHaveValue(projectC);

  await page.locator(".csv-cell-input").nth(5).fill(editedName);
  await page.locator(".csv-row-delete-btn").nth(2).click();
  await expectCsvSaved(page);
  await expect(page.locator(".csv-cell-input").nth(0)).toHaveValue(projectA);
  await expect(page.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);
  await expect(page.locator(".csv-cell-input").nth(5)).toHaveValue(editedName);
  await expect(page.locator(".csv-cell-input")).toHaveCount(8);

  await page.reload();
  await expect(page.locator(".csv-cell-input").nth(0)).toHaveValue(projectA);
  await expect(page.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);
  await expect(page.locator(".csv-cell-input").nth(5)).toHaveValue(editedName);

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSVファイルを保存（ダウンロード）" }).click(),
  ]);
  const exportedCsv = await downloadText(csvDownload);
  expect(exportedCsv.charCodeAt(0)).toBe(0xfeff);
  expect(exportedCsv).toContain(projectA);
  expect(exportedCsv).toContain(editedName);
  expect(exportedCsv).not.toContain(projectC);
  expect(exportedCsv).not.toContain("__row_id");
  expect(exportedCsv).toContain('"停電,点検"');
  expect(exportedCsv).toContain('"引用""メモ"');

  await importCsv(page, exportedCsv, "roundtrip-exported.csv");
  await expectCsvSaved(page);
  await expect(page.locator(".csv-cell-input").nth(0)).toHaveValue(projectA);
  await expect(page.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);
  await expect(page.locator(".csv-cell-input").nth(5)).toHaveValue(editedName);

  const [excelDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excelで保存" }).click(),
  ]);
  const exportedExcel = await downloadText(excelDownload);
  expect(excelDownload.suggestedFilename()).toMatch(/\.xls$/);
  expect(exportedExcel).toContain("物件A");
  expect(exportedExcel).toContain(editedName);
  expect(exportedExcel).not.toContain("__row_id");
});

test("CSV import decodes Shift_JIS files without mojibake", async ({ page }) => {
  const shiftJisCsv = Buffer.from([
    112, 114, 111, 106, 101, 99, 116, 95, 105, 100, 44, 112, 114, 111, 112, 101,
    114, 116, 121, 95, 110, 97, 109, 101, 44, 116, 105, 116, 108, 101, 95, 115,
    117, 98, 106, 101, 99, 116, 10, 83, 74, 73, 83, 45, 49, 44, 131, 101, 131,
    88, 131, 103, 131, 125, 131, 147, 131, 86, 131, 135, 131, 147, 44, 144, 221,
    148, 245, 137, 252, 143, 67, 10,
  ]);

  await registerOrLogin(page);
  await openCsv(page);
  await importCsvBuffer(page, shiftJisCsv, "shift-jis.csv");

  await expect(page.getByText(/文字コード: Shift_JIS \/ CP932/)).toBeVisible();
  await expect(page.locator(".csv-cell-input").nth(0)).toHaveValue("SJIS-1");
  await expect(page.locator(".csv-cell-input").nth(1)).toHaveValue("テストマンション");
  await expect(page.locator(".csv-cell-input").nth(2)).toHaveValue("設備改修");
  await expect(page.locator(".csv-editor-panel")).not.toContainText("�");
});

test("CSV edits from a second tab survive reload without reverting first-tab data", async ({ browser }) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  const projectA = uniqueValue("TAB-A");
  const projectB = uniqueValue("TAB-B");
  const secondTabName = `${projectB}-別タブ編集`;
  const csvText = [
    "project_id,property_name,title_subject,note_special",
    `${projectA},タブ物件A,設備改修,1行目`,
    `${projectB},タブ物件B,PAS交換,2行目`,
  ].join("\n");

  await registerOrLogin(pageA);
  await openCsv(pageA);
  await importCsv(pageA, csvText);
  await expectCsvSaved(pageA);
  await expect(pageA.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);

  await openCsv(pageB);
  await expect(pageB.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);
  await pageB.locator(".csv-cell-input").nth(5).fill(secondTabName);
  await expect(pageB.locator(".csv-cell-input").nth(5)).toHaveValue(secondTabName);
  await expectCsvSaved(pageB);
  await pageB.waitForTimeout(1200);
  await expectSharedSynced(pageB);

  await pageA.reload();
  await expect(pageA.locator(".csv-cell-input").nth(0)).toHaveValue(projectA);
  await expect(pageA.locator(".csv-cell-input").nth(4)).toHaveValue(projectB);
  await expect(pageA.locator(".csv-cell-input").nth(5)).toHaveValue(secondTabName);

  await context.close();
});
