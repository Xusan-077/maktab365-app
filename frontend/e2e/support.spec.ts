import { expect, test } from "@playwright/test";
import { randomPassword } from "./credentials";

/** Har ishga tushirishda yangi akkaunt — backend bazasi tozalanmasa ham to'qnashuv yo'q. */
const email = `e2e-support-${Date.now()}@example.com`;
const password = randomPassword();
const TOPIC_URL = "/uz/darsliklar/algebra-9/algebra-9-viyet-teoremasi";

test.describe("yordam va aloqa", () => {
  test("mehmon: validatsiya, keyin xabar yuborish", async ({ page }) => {
    await page.goto("/uz/yordam");
    await expect(page.getByRole("heading", { name: "Yordam va aloqa", level: 1 })).toBeVisible();

    const form = page.getByTestId("support-form");
    await form.getByRole("button", { name: "Yuborish" }).click();
    await expect(form.getByText("Emailingizni kiriting")).toBeVisible();
    await expect(form.getByText("Xabarni yozing")).toBeVisible();
    await expect(page.getByTestId("support-sent")).toHaveCount(0);

    await form.getByLabel("Email").fill("mehmon@example.com");
    await form.getByLabel("Xabaringiz").fill("qisqa");
    await form.getByRole("button", { name: "Yuborish" }).click();
    await expect(form.getByText("Xabar kamida 10 ta belgidan iborat bo'lsin")).toBeVisible();

    await form.getByText("Taklif", { exact: true }).click();
    await form
      .getByLabel("Xabaringiz")
      .fill("Qidiruvga tarix fani bo'yicha filtr qo'shsangiz yaxshi bo'lardi.");
    await form.getByRole("button", { name: "Yuborish" }).click();

    await expect(page.getByTestId("support-sent")).toContainText("Xabaringiz yuborildi");
    await page.getByRole("button", { name: "Yana xabar yuborish" }).click();
    await expect(page.getByTestId("support-form")).toBeVisible();
  });

  test("kirgan foydalanuvchi: mavzudan xato yuboradi va panelda holatini ko'radi", async ({
    page,
  }) => {
    await page.goto("/uz/royxatdan-otish");
    const register = page.getByTestId("register-form");
    await register.getByLabel("Email").fill(email);
    await register.getByLabel("Parol", { exact: true }).fill(password);
    await register.getByLabel("Parolni takrorlang").fill(password);
    await register.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();

    await expect(page).toHaveURL(/\/uz\/onboarding$/);
    await page.getByLabel("Ismingiz").fill("E2E Yordam");
    await page.getByRole("combobox", { name: "Sinfingiz" }).click();
    await page.getByRole("option", { name: "9-sinf" }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page).toHaveURL(/\/uz\/kabinet$/);

    // Mavzudagi "Xato topdingizmi?" — dialog mavzu va sahifa manzili bilan yuboradi.
    await page.goto(TOPIC_URL);
    await page.getByRole("button", { name: "Xato topdingizmi?" }).click();
    const dialog = page.getByRole("dialog", { name: "Xato haqida xabar" });
    // Kirgan foydalanuvchidan email so'ralmaydi.
    await expect(dialog.getByLabel("Email")).toHaveCount(0);
    await dialog
      .getByLabel("Xabaringiz")
      .fill("Formulada ikkinchi misol natijasi noto'g'ri chiqqan.");
    await dialog.getByRole("button", { name: "Yuborish" }).click();
    await expect(dialog.getByTestId("support-sent")).toBeVisible();
    await dialog.getByTestId("support-sent").getByRole("button", { name: "Tayyor" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/uz/kabinet/yordam");
    const mine = page.getByTestId("my-support");
    await expect(mine).toContainText("Darslikdagi xato");
    await expect(mine).toContainText("Formulada ikkinchi misol natijasi noto'g'ri chiqqan.");
    await expect(mine).toContainText("Yangi");

    // Panel formasidan ham yuboriladi va ro'yxat yangilanadi.
    const form = page.getByTestId("support-form");
    await form.getByText("Savol", { exact: true }).click();
    await form
      .getByLabel("Xabaringiz")
      .fill("Natijalar bo'limida o'tgan haftani ko'rsa bo'ladimi?");
    await form.getByRole("button", { name: "Yuborish" }).click();
    await expect(page.getByTestId("support-sent")).toBeVisible();
    await expect(page.getByTestId("my-support").getByRole("listitem")).toHaveCount(2);
  });
});
