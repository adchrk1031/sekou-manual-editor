import { expect, test } from "@playwright/test";

const adminUser = {
  name: "E2E Admin",
  email: "e2e.admin@example.com",
  password: "testpass123",
};

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

test("notice pattern pills keep checkbox and label centered", async ({ page }) => {
  await registerOrLogin(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/notice");
  await expect(page.getByRole("heading", { name: "停電案内文" })).toBeVisible();

  const pill = page.locator(".notice-pattern-pill").filter({ hasText: "メーター交換ありバージョン" });
  await expect(pill).toBeVisible();
  const layout = await pill.evaluate((element) => {
    const input = element.querySelector('input[type="checkbox"]');
    const label = element.querySelector("span");
    const pillStyle = window.getComputedStyle(element);
    return {
      display: pillStyle.display,
      alignItems: pillStyle.alignItems,
      justifyContent: pillStyle.justifyContent,
      flexWrap: pillStyle.flexWrap,
      inputAlignSelf: input ? window.getComputedStyle(input).alignSelf : "",
      inputMarginTop: input ? window.getComputedStyle(input).marginTop : "",
      labelDisplay: label ? window.getComputedStyle(label).display : "",
      labelAlignItems: label ? window.getComputedStyle(label).alignItems : "",
    };
  });

  expect(layout).toMatchObject({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "nowrap",
    inputAlignSelf: "center",
    inputMarginTop: "0px",
    labelAlignItems: "center",
  });
  expect(["flex", "inline-flex"]).toContain(layout.labelDisplay);
});
