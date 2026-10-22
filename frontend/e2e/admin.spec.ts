import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";

/**
 * Admin (M10): editor kitob yaratadi → bob → mavzu → tekshirildi → nashr → ochiq sahifada ko'rinadi.
 * Oddiy foydalanuvchi uchun /admin yo'q (404). Editor roli backend konteynerida beriladi
 * (rolni faqat admin o'zgartiradi, UI orqali editor bo'lib bo'lmaydi).
 */
const stamp = Date.now();
const password = randomPassword();
const editorEmail = `e2e-editor-${stamp}@example.com`;
const studentEmail = `e2e-nonstaff-${stamp}@example.com`;
const BOOK_SLUG = `e2e-fizika-${stamp}`;
const BOOK_TITLE = `E2E Fizika ${stamp}`;
const TOPIC_TITLE = `E2E mavzu ${stamp}`;

async function register(page: Page, email: string) {
  await page.goto("/uz/royxatdan-otish");
  const form = page.getByTestId("register-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Parol", { exact: true }).fill(password);
  await form.getByLabel("Parolni takrorlang").fill(password);
  await form.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();

  await expect(page).toHaveURL(/\/uz\/onboarding$/);
  await page.getByLabel("Ismingiz").fill("E2E Muharrir");
  await page.getByRole("combobox", { name: "Sinfingiz" }).click();
  await page.getByRole("option", { name: "9-sinf" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await expect(page).toHaveURL(/\/uz\/kabinet$/);
}

async function signIn(page: Page, email: string) {
  await page.goto("/uz/kirish");
  const form = page.getByTestId("login-form");
  const step = page.getByTestId("email-step");
  // Gidratsiyadan oldingi bosish yo'qolishi mumkin — ikkinchi qadam chiqquncha takrorlanadi.
  await expect(async () => {
    if (await form.isVisible()) return;
    await step.getByLabel("Email").fill(email);
    await step.getByRole("button", { name: "Davom etish" }).click();
    await expect(form).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await form.getByLabel("Parol", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Kirish" }).click();
  await expect(page).toHaveURL(/\/uz\/(kabinet|ustoz)$/);
}

function promoteToEditor(email: string) {
  const code = `from apps.accounts.models import User; User.objects.filter(email='${email}').update(role='editor')`;
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "backend", "python", "manage.py", "shell", "-c", code],
    { cwd: join(process.cwd(), ".."), encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`Rol berilmadi:\n${result.stdout}${result.stderr}`);
}

test("oddiy foydalanuvchi uchun /admin mavjud emas (404)", async ({ page }) => {
  await register(page, studentEmail);
  await page.goto("/uz/admin");
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
});

test("editor: kitob → bob → mavzu → tekshirildi → nashr → ochiq sahifada ko'rinadi", async ({
  page,
  context,
}) => {
  await register(page, editorEmail);
  promoteToEditor(editorEmail);
  // Eski sessiyada rol yo'q (student): yangi sessiya editor sifatida.
  await context.clearCookies();
  await signIn(page, editorEmail);

  // --- Qobiq: admin sidebar, marketing/panel elementlari yo'q, foydalanuvchilar bo'limi yo'q.
  await page.goto("/uz/admin");
  await expect(page.getByRole("heading", { name: "Boshqaruv paneli", level: 1 })).toBeVisible();
  await expect(page.locator("[data-layout=admin]").first()).toBeVisible();
  await expect(page.locator("[data-layout=marketing]")).toHaveCount(0);
  await expect(page.locator("[data-app-sidebar]")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Admin menyusi" });
  await expect(nav.getByRole("link", { name: "Kitoblar", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Foydalanuvchilar" })).toHaveCount(0);

  await page.goto("/uz/admin/foydalanuvchilar");
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();

  // --- Kitob yaratish.
  await page.goto("/uz/admin/kitoblar");
  await page.getByRole("link", { name: "Yangi kitob" }).first().click();
  const form = page.getByTestId("book-form");
  await form.getByLabel("Slug (kitob identifikatori)").fill(BOOK_SLUG);
  await form.getByRole("combobox", { name: "Fan" }).click();
  await page.getByRole("option").first().click();
  await form.getByRole("combobox", { name: "Sinf" }).click();
  await page.getByRole("option", { name: "7-sinf" }).click();
  await form.getByLabel("O'zbekcha (majburiy)").fill(BOOK_TITLE);
  await form.getByLabel("Muallif", { exact: true }).fill("E2E mualliflari");
  await form.getByLabel("Nashr", { exact: true }).fill("1-nashr");
  await form.getByLabel("Saytda ko'rsatish").check();
  await form.getByRole("button", { name: "Kitob yaratish" }).click();

  await expect(page).toHaveURL(/\/uz\/admin\/kitoblar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: BOOK_TITLE, level: 1 })).toBeVisible();

  // --- Bob qo'shish.
  await page.getByRole("button", { name: "Bob qo'shish" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("O'zbekcha (majburiy)").fill("Birinchi bob");
  await dialog.getByRole("button", { name: "Yaratish" }).click();
  const chapter = page.getByTestId("tree-chapter");
  await expect(chapter).toContainText("Birinchi bob");

  // --- Mavzu qo'shish.
  await chapter.getByRole("link", { name: "Mavzu qo'shish" }).click();
  const topicForm = page.getByTestId("topic-form");
  await topicForm.getByLabel("O'zbekcha (majburiy)").fill(TOPIC_TITLE);
  await topicForm.getByRole("button", { name: "Yaratish" }).click();
  await expect(page).toHaveURL(/\/uz\/admin\/mavzular\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Qoralama", { exact: true })).toBeVisible();

  // --- Nashr oqimi: editor "Qoralamaga qaytarish" ni ko'rmaydi.
  await page.getByRole("button", { name: "Tekshirildi" }).click();
  await expect(page.getByText("Tekshirilgan", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nashr qilish" }).click();
  await expect(page.getByText("Nashr qilingan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Qoralamaga qaytarish" })).toHaveCount(0);

  // --- Ochiq sahifada ko'rinadi (mehmon sifatida: sessiyasiz kontekst).
  const origin = new URL(page.url()).origin;
  const guest = await context.browser()!.newContext({ baseURL: origin, locale: "uz" });
  const publicPage = await guest.newPage();
  await publicPage.goto(`/uz/darsliklar/${BOOK_SLUG}`);
  await expect(publicPage.getByText(TOPIC_TITLE).first()).toBeVisible();
  await guest.close();

  // --- Dashboard oxirgi o'zgarishlarni ko'rsatadi.
  await page.goto("/uz/admin");
  await expect(page.getByTestId("recent-activity")).toContainText(`e2e-mavzu-${stamp}`);
});
