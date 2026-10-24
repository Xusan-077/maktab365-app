import { expect, test } from "@playwright/test";
import { randomPassword } from "./credentials";
import { register } from "./helpers";

/** Har ishga tushirishda yangi akkaunt — backend bazasi tozalanmasa ham to'qnashuv yo'q. */
const email = `e2e-support-${Date.now()}@example.com`;
const password = randomPassword();

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
    await expect(form.getByText("Xabar kamida 15 ta belgidan iborat bo'lsin")).toBeVisible();

    // Uzunligi yetarli, lekin ma'nosiz — yuborilmaydi.
    await form.getByLabel("Xabaringiz").fill("Dnxdnxdnxdnxdnxdnx");
    await form.getByRole("button", { name: "Yuborish" }).click();
    await expect(form.getByText("Xabarni aniqroq yozing", { exact: false })).toBeVisible();

    await form.getByText("Taklif", { exact: true }).click();
    await form
      .getByLabel("Xabaringiz")
      .fill("Qidiruvga tarix fani bo'yicha filtr qo'shsangiz yaxshi bo'lardi.");
    await form.getByRole("button", { name: "Yuborish" }).click();

    await expect(page.getByTestId("support-sent")).toContainText("Xabaringiz yuborildi");
    await page.getByRole("button", { name: "Yana xabar yuborish" }).click();
    await expect(page.getByTestId("support-form")).toBeVisible();
  });

  test("kirgan foydalanuvchi: darslikdagi xatoni yuboradi va panelda holatini ko'radi", async ({
    page,
  }) => {
    await register(page, email, password, "E2E Yordam");

    await page.goto("/uz/kabinet/yordam");
    // Kirgan foydalanuvchidan email so'ralmaydi.
    const form = page.getByTestId("support-form");
    await expect(form.getByLabel("Email")).toHaveCount(0);
    await form.getByText("Darslikdagi xato", { exact: true }).click();
    await form
      .getByLabel("Xabaringiz")
      .fill("Formulada ikkinchi misol natijasi noto'g'ri chiqqan.");
    await form.getByRole("button", { name: "Yuborish" }).click();
    await expect(page.getByTestId("support-sent")).toBeVisible();
    const mine = page.getByTestId("my-support");
    await expect(mine).toContainText("Darslikdagi xato");
    await expect(mine).toContainText("Formulada ikkinchi misol natijasi noto'g'ri chiqqan.");
    await expect(mine).toContainText("Yangi");

    // Ikkinchi xabar ham yuboriladi va ro'yxat yangilanadi.
    await page.getByRole("button", { name: "Yana xabar yuborish" }).click();
    await form.getByText("Savol", { exact: true }).click();
    await form.getByLabel("Xabaringiz").fill("Darslikni qaysi formatda yuklab olsa bo'ladi?");
    await form.getByRole("button", { name: "Yuborish" }).click();
    await expect(page.getByTestId("support-sent")).toBeVisible();
    await expect(page.getByTestId("my-support").getByRole("listitem")).toHaveCount(2);
  });
});
