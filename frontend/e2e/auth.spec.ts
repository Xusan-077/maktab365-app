import { expect, test, type Page } from "@playwright/test";

/** Har ishga tushirishda yangi akkaunt — backend bazasi tozalanmasa ham to'qnashuv yo'q. */
const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-kuchli-parol-2026";

async function submitLogin(page: Page, pass = password) {
  const form = page.getByTestId("login-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Parol", { exact: true }).fill(pass);
  await form.getByRole("button", { name: "Kirish" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Foydalanuvchi menyusi/ }).click();
  await page.getByRole("menuitem", { name: "Chiqish" }).click();
  await expect(page).toHaveURL(/\/uz$/);
}

test.describe.serial("email + parol", () => {
  test("ro'yxatdan o'tish → onboarding → kabinet", async ({ page }) => {
    await page.goto("/uz/kirish?mode=register");
    const form = page.getByTestId("register-form");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Parol", { exact: true }).fill("123");
    await form.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();
    await expect(form.getByText("Parol kamida 8 ta belgidan iborat bo'lsin.")).toBeVisible();

    await form.getByLabel("Parol", { exact: true }).fill(password);
    await form.getByLabel("Parolni takrorlang").fill(password);
    await form.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();

    await expect(page).toHaveURL(/\/uz\/onboarding$/);
    await page.getByLabel("Ismingiz").fill("E2E O'quvchi");
    await page.getByRole("combobox", { name: "Sinfingiz" }).click();
    await page.getByRole("option", { name: "9-sinf" }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();

    await expect(page).toHaveURL(/\/uz\/kabinet$/);
    // Tasdiqlanmagan email — bloklamaydigan banner.
    await expect(page.getByTestId("email-verify-banner")).toBeVisible();
  });

  test("chiqish: panel yana kirishni talab qiladi", async ({ page }) => {
    await page.goto("/uz/kirish");
    await submitLogin(page);
    await expect(page).toHaveURL(/\/uz\/kabinet$/);

    await signOut(page);
    await page.goto("/uz/kabinet");
    await expect(page).toHaveURL(/\/uz\/kirish\?callbackUrl=%2Fuz%2Fkabinet$/);
  });

  test("kirish: noto'g'ri parol, keyin to'g'ri parol bilan callbackUrl'ga", async ({ page }) => {
    await page.goto("/uz/sozlamalar");
    await expect(page).toHaveURL(/\/uz\/kirish\?callbackUrl=/);

    await submitLogin(page, "notogri-parol-1");
    await expect(page.getByTestId("login-form").getByRole("alert")).toContainText(
      "Email yoki parol noto'g'ri.",
    );

    await submitLogin(page);
    await expect(page).toHaveURL(/\/uz\/sozlamalar$/);
    await expect(page.getByRole("heading", { name: "Xavfsizlik" })).toBeVisible();

    // Kirgan foydalanuvchi /kirish ga qaytsa — o'z paneliga.
    await page.goto("/uz/kirish");
    await expect(page).toHaveURL(/\/uz\/kabinet$/);
  });
});
