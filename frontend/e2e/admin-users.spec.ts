import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";
import { signIn } from "./helpers";
import { manage } from "./manage";

/**
 * Admin faqat admin panelda: kirgach /admin ga tushadi, sayt va panellardan qaytariladi, yon
 * panelda «saytga o'tish» yo'q. Foydalanuvchilar boshqaruvi: yaratish (vaqtinchalik parol),
 * rol, bloklash, o'chirish — har biri tasdiqlanadi; asosiy admin va o'zi himoyalangan.
 *
 * `create_admin` env admin belgisini ham qo'yadi (`is_env_admin`). Env orqali kirishning o'zi
 * (ADMIN_EMAIL/ADMIN_PASSWORD bilan ishga tushgan backend) — oxirgi test, `E2E_ENV_ADMIN_*` bilan.
 */
const stamp = Date.now();
const adminEmail = `e2e-admin-${stamp}@example.com`;
const adminPassword = randomPassword();
const userEmail = `e2e-managed-${stamp}@example.com`;

async function findUser(page: Page, email: string) {
  await page.getByRole("searchbox", { name: "Ism yoki email bo'yicha qidirish" }).fill(email);
  const row = page.getByTestId("user-row").filter({ hasText: email });
  await expect(row).toHaveCount(1);
  return row;
}

test.describe.serial("Admin: faqat admin panel va foydalanuvchilar", () => {
  test("kirgach /admin ga tushadi; sayt va panellar /admin ga qaytaradi; saytga havola yo'q", async ({
    page,
  }) => {
    manage(["create_admin"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword });
    await signIn(page, adminEmail, adminPassword);
    await expect(page).toHaveURL(/\/uz\/admin$/);

    for (const path of ["/uz/darsliklar", "/uz/kabinet", "/uz/ustoz", "/uz", "/uz/sozlamalar"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/uz\/admin$/);
    }
    await page.goto("/uz/kirish");
    await expect(page).toHaveURL(/\/uz\/admin$/);

    // Yon panel: saytga o'tish havolasi yo'q, faqat chiqish.
    const sidebar = page.locator("[data-admin-sidebar]");
    await expect(sidebar.getByRole("link", { name: /Saytga o'tish/ })).toHaveCount(0);
    await expect(sidebar.getByRole("button", { name: "Chiqish" })).toBeVisible();

    // Backend ham admin uchun o'quvchi API'larini yopadi.
    const learner = await page.request.get("/api/backend/api/v1/me/library/");
    expect(learner.status()).toBe(403);
  });

  test("foydalanuvchi yaratadi, rolini o'zgartiradi, bloklaydi va o'chiradi", async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await page.goto("/uz/admin/foydalanuvchilar");
    await expect(page.getByRole("heading", { name: "Foydalanuvchilar", level: 1 })).toBeVisible();

    // --- Yaratish: parolsiz → vaqtinchalik parol bir marta ko'rsatiladi.
    await page.getByRole("button", { name: "Foydalanuvchi qo'shish" }).first().click();
    const create = page.getByRole("dialog");
    await create.getByLabel("Email").fill(userEmail);
    await create.getByLabel("Ism (ixtiyoriy)").fill("E2E Boshqariladigan");
    await create.getByRole("button", { name: "Yaratish" }).click();
    const temporary = create.getByLabel("Vaqtinchalik parol");
    await expect(temporary).toBeVisible();
    await expect(temporary).not.toHaveValue("");
    await create.getByRole("button", { name: "Tayyor" }).click();

    let row = await findUser(page, userEmail);
    await expect(row).toContainText("O'quvchi");
    await expect(row).toContainText("Faol");

    // --- Rolni o'zgartirish (tasdiqlash tugmasi tanlangan rolni aytadi).
    await row.getByRole("button", { name: /rolini o'zgartirish/ }).click();
    const role = page.getByRole("dialog");
    await role.getByRole("combobox", { name: "Yangi rol" }).click();
    await page.getByRole("option", { name: "O'qituvchi" }).click();
    await role.getByRole("button", { name: "Rolni «O'qituvchi» ga o'zgartirish" }).click();
    await expect(row).toContainText("O'qituvchi");

    // --- Bloklash: tasdiqlanmaguncha o'zgarmaydi.
    await row.getByRole("button", { name: /ni bloklash/ }).click();
    const block = page.getByRole("dialog");
    await block.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(row).toContainText("Faol");
    await row.getByRole("button", { name: /ni bloklash/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bloklash", exact: true }).click();
    await expect(row).toContainText("Bloklangan");

    // --- Blokdan chiqarish, so'ng o'chirish (tasdiqlash bilan).
    await row.getByRole("button", { name: /ni blokdan chiqarish/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Blokdan chiqarish", exact: true })
      .click();
    await expect(row).toContainText("Faol");

    await row.getByRole("button", { name: /ni o'chirish/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "O'chirish", exact: true }).click();
    row = page.getByTestId("user-row").filter({ hasText: userEmail });
    await expect(row).toHaveCount(0);
  });

  test("asosiy admin va o'zingiz himoyalangan", async ({ page }) => {
    await signIn(page, adminEmail, adminPassword);
    await page.goto("/uz/admin/foydalanuvchilar");
    const own = await findUser(page, adminEmail);
    await expect(own).toContainText("Asosiy admin");
    for (const button of await own.getByRole("button").all()) {
      await expect(button).toBeDisabled();
    }

    // Backend ham rad etadi (UI'siz): o'zini o'chirish.
    const me = (await (await page.request.get("/api/backend/api/v1/me/")).json()) as {
      id: string;
    };
    const response = await page.request.delete(`/api/backend/api/v1/admin/users/${me.id}/`);
    expect(response.status()).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("env_admin_protected");
  });
});

test.describe("Env orqali kirish (ADMIN_EMAIL/ADMIN_PASSWORD)", () => {
  const envEmail = process.env.E2E_ENV_ADMIN_EMAIL;
  const envPassword = process.env.E2E_ENV_ADMIN_PASSWORD;
  test.skip(
    !envEmail || !envPassword,
    "backend ADMIN_EMAIL/ADMIN_PASSWORD bilan ishga tushirilib, E2E_ENV_ADMIN_EMAIL/PASSWORD berilmagan",
  );

  test("login formasi bilan kiradi va to'g'ridan-to'g'ri /admin ga tushadi", async ({ page }) => {
    await signIn(page, envEmail!, envPassword!);
    await expect(page).toHaveURL(/\/uz\/admin$/);
    await expect(page.getByRole("heading", { name: "Boshqaruv paneli", level: 1 })).toBeVisible();
  });

  test("noto'g'ri parol umumiy xato beradi", async ({ page }) => {
    await page.goto("/uz/kirish");
    const step = page.getByTestId("email-step");
    const form = page.getByTestId("login-form");
    await expect(async () => {
      if (await form.isVisible()) return;
      await step.getByLabel("Email").fill(envEmail!);
      await step.getByRole("button", { name: "Parol bilan kirish" }).click();
      await expect(form).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await form.getByLabel("Parol", { exact: true }).fill(`${envPassword}-xato`);
    await form.getByRole("button", { name: "Kirish" }).click();
    await expect(page.getByText("Email yoki parol noto'g'ri.")).toBeVisible();
    await expect(page).toHaveURL(/\/uz\/kirish/);
  });
});
