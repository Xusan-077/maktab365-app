import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";

/** Har ishga tushirishda yangi akkaunt — backend bazasi tozalanmasa ham to'qnashuv yo'q. */
const email = `e2e-${Date.now()}@example.com`;
const password = randomPassword();

/** Ikki qadam: email → "Davom etish" → parol → "Kirish". Birinchi qadam backend'ga murojaat qilmaydi. */
async function submitLogin(page: Page, pass = password) {
  const form = page.getByTestId("login-form");
  const step = page.getByTestId("email-step");
  // Gidratsiyadan oldingi bosish yo'qolishi mumkin — ikkinchi qadam chiqquncha takrorlanadi.
  await expect(async () => {
    if (await form.isVisible()) return;
    await step.getByLabel("Email").fill(email);
    await step.getByRole("button", { name: "Davom etish" }).click();
    await expect(form).toBeVisible({ timeout: 2_000 });
  }).toPass();
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
    await page.goto("/uz/royxatdan-otish");
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

  test("kirish sahifasi: tabsiz, ikkinchi qadamda email matn va 'Boshqa email'", async ({
    page,
  }) => {
    await page.goto("/uz/kirish");
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Google bilan davom etish" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ro'yxatdan o'ting" })).toHaveAttribute(
      "href",
      "/uz/royxatdan-otish",
    );

    const step = page.getByTestId("email-step");
    await step.getByLabel("Email").fill(email);
    await step.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByTestId("login-email")).toHaveText(email);
    await expect(
      page.getByRole("button", { name: "Parolsiz: kodni emailga yuborish" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Parolni unutdingizmi?" })).toBeVisible();

    await page.getByRole("button", { name: "Boshqa email" }).click();
    await expect(step.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByRole("link", { name: "Kirmasdan davom etish" })).toBeVisible();
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
