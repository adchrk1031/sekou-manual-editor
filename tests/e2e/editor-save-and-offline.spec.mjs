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

async function openEditor(page) {
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "施工計画書自動発行ツール" })).toBeVisible();
  await expect(page.locator('section[aria-label="保存状態"]')).toBeVisible();
}

async function openTracking(page) {
  await page.goto("/tracking");
  await expect(page.getByRole("heading", { name: "ログイン管理" })).toBeVisible();
}

async function createProjectInEditor(page) {
  await page.getByRole("button", { name: "新規案件" }).click();
  await expect(page.getByText("未入力状態で開始できます")).toHaveCount(0);
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toBeVisible();
}

async function selectProjectByName(page, propertyName) {
  const searchInput = page.locator('input[placeholder="案件ID・物件名で検索"]').first();
  await searchInput.click();
  await searchInput.fill(propertyName);
  const target = page.locator(".project-picker-item").filter({ hasText: propertyName }).first();
  await expect(target).toBeVisible();
  await target.click();
}

async function updateProjectBasics(page, values) {
  if (values.propertyName !== undefined) {
    await page.locator('#card-pdf1 input[data-required-key="propertyName"]').fill(values.propertyName);
  }
  if (values.coverRecipientSuffix !== undefined) {
    await page.locator('#card-pdf1 input[data-required-key="coverRecipientSuffix"]').fill(values.coverRecipientSuffix);
  }
  if (values.titleSubject !== undefined) {
    await page.locator('#card-pdf1 input[data-required-key="titleSubject"]').fill(values.titleSubject);
  }
  if (values.propertyAddress !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="propertyAddress"]').fill(values.propertyAddress);
  }
  if (values.workDateStart !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="workDateStart"]').fill(values.workDateStart);
  }
  if (values.workDateEnd !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="workDateEnd"]').fill(values.workDateEnd);
  }
  if (values.outageDateStart !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="outageDateStart"]').fill(values.outageDateStart);
  }
  if (values.outageDateEnd !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="outageDateEnd"]').fill(values.outageDateEnd);
  }
  if (values.outageTimeStart !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="outageTimeStart"]').fill(values.outageTimeStart);
  }
  if (values.outageTimeEnd !== undefined) {
    await page.locator('#card-pdf3 input[data-required-key="outageTimeEnd"]').fill(values.outageTimeEnd);
  }
}

async function expectSavePanelToContain(page, patterns) {
  const savePanel = page.locator('section[aria-label="保存状態"]');
  await expect.poll(async () => {
    const text = (await savePanel.textContent()) ?? "";
    const normalizedText = text.replace(/\s+/g, " ");
    return patterns.every((pattern) => pattern.test(normalizedText));
  }, { timeout: 30_000 }).toBe(true);
}

async function expectRestoreSource(page, workspaceSourceLabel, configSourceLabel = workspaceSourceLabel) {
  await expectSavePanelToContain(page, [
    new RegExp(`現在採用中の復元元.*案件\\/CSV: ${workspaceSourceLabel} \\/ 設定: ${configSourceLabel}`),
  ]);
}

async function runManualSave(page) {
  await page.getByTestId("editor-manual-save").click();
}

async function expectProjectSavedLabel(page) {
  await expect.poll(async () => {
    const text = (await page.locator('section[aria-label="保存状態"]').textContent()) ?? "";
    return /端末保存（案件）.*案件保存済み/.test(text.replace(/\s+/g, " "));
  }, { timeout: 30_000 }).toBe(true);
}

async function expectOfflineIndicator(page) {
  await expect.poll(async () => {
    const text = (await page.locator('section[aria-label="保存状態"]').textContent()) ?? "";
    return /共有同期.*オフライン \/ 再接続待ち/.test(text.replace(/\s+/g, " "));
  }, { timeout: 30_000 }).toBe(true);
}

async function exportLocalStoragePayload(page) {
  await openTracking(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "データをエクスポート" }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path, "utf8"));
}

async function importLocalStoragePayload(page, payload) {
  const dialogMessages = [];
  const onDialog = async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  };
  page.on("dialog", onDialog);
  const backupDownloadPromise = page.waitForEvent("download");
  const reloadPromise = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
    timeout: 15_000,
  }).catch(() => null);
  await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({
    name: "sekou-localstorage-restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload, null, 2)),
  });
  const backupDownload = await backupDownloadPromise;
  const backupName = backupDownload.suggestedFilename();
  await reloadPromise;
  await page.waitForLoadState("domcontentloaded").catch(() => null);
  page.off("dialog", onDialog);
  expect(backupName).toContain("before-import");
  expect(dialogMessages.some((message) => message.includes("自動バックアップ"))).toBe(true);
}

test("editor saves edited project and restores after reload and re-login", async ({ page, browser }) => {
  const propertyName = uniqueValue("E2E物件");
  const updatedSubject = uniqueValue("停電工事");

  await registerOrLogin(page);
  await openEditor(page);
  await createProjectInEditor(page);
  await updateProjectBasics(page, {
    propertyName,
    coverRecipientSuffix: "管理組合御中",
    titleSubject: updatedSubject,
    propertyAddress: "東京都千代田区1-1-1",
    workDateStart: "2026-05-20",
    workDateEnd: "2026-05-20",
    outageDateStart: "2026-05-20",
    outageDateEnd: "2026-05-20",
    outageTimeStart: "09:00",
    outageTimeEnd: "10:00",
  });

  await runManualSave(page);
  await expectProjectSavedLabel(page);

  await page.reload();
  await selectProjectByName(page, propertyName);
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(propertyName);
  await expect(page.locator('#card-pdf1 input[data-required-key="titleSubject"]')).toHaveValue(updatedSubject);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await registerOrLogin(secondPage);
  await openEditor(secondPage);
  await selectProjectByName(secondPage, propertyName);
  await expect(secondPage.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(propertyName);
  await expect(secondPage.locator('#card-pdf1 input[data-required-key="titleSubject"]')).toHaveValue(updatedSubject);
  await secondContext.close();
});

test("editor keeps offline edits locally and syncs them after reconnect", async ({ page, browser }) => {
  const basePropertyName = uniqueValue("Offline物件");
  const offlinePropertyName = `${basePropertyName}-再接続確認`;

  await registerOrLogin(page);
  await openEditor(page);
  await createProjectInEditor(page);
  await updateProjectBasics(page, {
    propertyName: basePropertyName,
    coverRecipientSuffix: "管理組合御中",
    titleSubject: "オフライン復帰テスト",
    propertyAddress: "東京都中央区2-2-2",
    workDateStart: "2026-05-21",
    workDateEnd: "2026-05-21",
    outageDateStart: "2026-05-21",
    outageDateEnd: "2026-05-21",
    outageTimeStart: "13:00",
    outageTimeEnd: "14:00",
  });

  await runManualSave(page);
  await expectProjectSavedLabel(page);

  await page.context().setOffline(true);
  await page.waitForFunction(() => navigator.onLine === false);

  await updateProjectBasics(page, {
    propertyName: offlinePropertyName,
    titleSubject: "オフライン編集中",
  });

  await runManualSave(page);
  await expectProjectSavedLabel(page);
  await expectOfflineIndicator(page);
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(offlinePropertyName);
  await expect(page.locator('#card-pdf1 input[data-required-key="titleSubject"]')).toHaveValue("オフライン編集中");

  await page.context().setOffline(false);
  await page.waitForFunction(() => navigator.onLine === true);

  await expectSavePanelToContain(page, [
    /DB保存（案件\/CSV）.*保存済み/,
    /共有同期.*同期済み/,
  ]);

  await page.reload();
  await selectProjectByName(page, offlinePropertyName);
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(offlinePropertyName);
  await expect(page.locator('#card-pdf1 input[data-required-key="titleSubject"]')).toHaveValue("オフライン編集中");

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await registerOrLogin(secondPage);
  await openEditor(secondPage);
  await selectProjectByName(secondPage, offlinePropertyName);
  await expect(secondPage.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(offlinePropertyName);
  await expect(secondPage.locator('#card-pdf1 input[data-required-key="titleSubject"]')).toHaveValue("オフライン編集中");
  await secondContext.close();
});

test("tracking export and import restores local project data with pre-import backup", async ({ page }) => {
  const propertyName = uniqueValue("Export物件");
  const mutatedPropertyName = `${propertyName}-変更後`;
  const titleSubject = uniqueValue("復元確認");

  await registerOrLogin(page);
  await openEditor(page);
  await createProjectInEditor(page);
  await updateProjectBasics(page, {
    propertyName,
    coverRecipientSuffix: "管理組合御中",
    titleSubject,
    propertyAddress: "東京都港区3-3-3",
    workDateStart: "2026-05-22",
    workDateEnd: "2026-05-22",
    outageDateStart: "2026-05-22",
    outageDateEnd: "2026-05-22",
    outageTimeStart: "15:00",
    outageTimeEnd: "16:00",
  });
  await runManualSave(page);
  await expectProjectSavedLabel(page);

  const exportedPayload = await exportLocalStoragePayload(page);
  expect(exportedPayload.app).toBe("sekou-manual-editor");
  expect(Array.isArray(exportedPayload.items)).toBe(true);
  expect(exportedPayload.items.length).toBeGreaterThan(0);
  expect(exportedPayload.items.some((item) => item.key === "sekou-tool-session-v1")).toBe(false);
  expect(exportedPayload.items.some((item) => item.key === "sekou-auth-login-guard-v1")).toBe(false);
  expect(exportedPayload.items.some((item) => item.key === "sekou-local-save-meta-v1")).toBe(false);

  await openEditor(page);
  await selectProjectByName(page, propertyName);
  await updateProjectBasics(page, { propertyName: mutatedPropertyName });
  await runManualSave(page);
  await expectProjectSavedLabel(page);
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(mutatedPropertyName);

  await openTracking(page);
  await importLocalStoragePayload(page, exportedPayload);

  await openEditor(page);
  await selectProjectByName(page, propertyName);
  await expectRestoreSource(page, "JSONインポート");
  await expect(page.locator('#card-pdf1 input[data-required-key="propertyName"]')).toHaveValue(propertyName);
  await expect(page.locator('#card-pdf1 input[data-required-key="titleSubject"]')).toHaveValue(titleSubject);
});

test("expired session redirects to login page with re-login guidance", async ({ page }) => {
  await registerOrLogin(page);
  await page.evaluate(() => {
    const sessionRaw = window.localStorage.getItem("sekou-tool-session-v1");
    if (!sessionRaw) {
      throw new Error("session not found");
    }
    const session = JSON.parse(sessionRaw);
    session.expiresAt = Date.now() - 60_000;
    window.localStorage.setItem("sekou-tool-session-v1", JSON.stringify(session));
  });

  await page.goto("/editor");
  await page.waitForURL("**/");
  await expect(page.getByText("セッションの有効期限が切れたため、再ログインしてください。")).toBeVisible();
});
