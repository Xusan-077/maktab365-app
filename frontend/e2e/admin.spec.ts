import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";
import { manage } from "./manage";

/**
 * Admin: editor fan qo'shadi, nomini o'zgartiradi; admin bo'lmagan akkauntlar uchun /admin yo'q
 * (404). Editor roli backend'da beriladi (rolni faqat admin o'zgartiradi, UI orqali editor bo'lib
 * bo'lmaydi). Kitob (PDF) oqimi `pdf-books.spec.ts` da.
 */
const stamp = Date.now();
const password = randomPassword();
const editorEmail = `e2e-editor-${stamp}@example.com`;
const studentEmail = `e2e-nonstaff-${stamp}@example.com`;
const SUBJECT_SLUG = `e2e-fan-${stamp}`;
const SUBJECT_TITLE = `E2E fan ${stamp}`;
const RENAMED = `E2E fan (yangi nom) ${stamp}`;

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
  manage([
    "shell",
    "-c",
    `from apps.accounts.models import User; User.objects.filter(email='${email}').update(role='editor')`,
  ]);
}

test("oddiy foydalanuvchi uchun /admin mavjud emas (404)", async ({ page }) => {
  await register(page, studentEmail);
  await page.goto("/uz/admin");
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
  await page.goto("/uz/admin/fanlar");
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
  const api = await page.request.get("/api/backend/api/v1/admin/subjects/");
  expect(api.status()).toBe(403);
});

test("editor: qobiq, fan qo'shadi va nomini o'zgartiradi (o'chira olmaydi)", async ({
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
  await expect(nav.getByRole("link")).toContainText(["Bosh sahifa", "Kitoblar", "Fanlar"]);
  await expect(nav.getByRole("link", { name: "Foydalanuvchilar" })).toHaveCount(0);

  await page.goto("/uz/admin/foydalanuvchilar");
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();

  // --- Fan qo'shish: slug nomdan taklif qilinadi, qo'lda aniqlashtiramiz.
  await page.goto("/uz/admin/fanlar");
  await page.getByRole("button", { name: "Fan qo'shish" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("O'zbekcha (majburiy)").fill(SUBJECT_TITLE);
  await dialog.getByLabel("Slug", { exact: true }).fill(SUBJECT_SLUG);
  await dialog.getByRole("button", { name: "Yaratish" }).click();
  const table = page.getByTestId("subjects-table");
  await expect(table).toContainText(SUBJECT_TITLE);
  await expect(table).toContainText(SUBJECT_SLUG);

  // --- Nomini o'zgartirish (slug o'zgarmaydi).
  await page.getByRole("button", { name: `${SUBJECT_TITLE} fanini tahrirlash` }).click();
  const edit = page.getByRole("dialog");
  await expect(edit.getByLabel("Slug", { exact: true })).toBeDisabled();
  await edit.getByLabel("O'zbekcha (majburiy)").fill(RENAMED);
  await edit.getByRole("button", { name: "Saqlash" }).click();
  await expect(table).toContainText(RENAMED);

  // --- O'chirish tugmasi faqat admin'da: editor ko'rmaydi, API ham rad etadi.
  await expect(page.getByRole("button", { name: /fanini o'chirish/ })).toHaveCount(0);
  const subjects = (await (
    await page.request.get("/api/backend/api/v1/admin/subjects/?page_size=100")
  ).json()) as { results: { id: string; slug: string }[] };
  const created = subjects.results.find((row) => row.slug === SUBJECT_SLUG)!;
  const del = await page.request.delete(`/api/backend/api/v1/admin/subjects/${created.id}/`);
  expect(del.status()).toBe(403);

  // --- Dashboard oxirgi o'zgarishlarni ko'rsatadi.
  await page.goto("/uz/admin");
  await expect(page.getByTestId("recent-activity")).toContainText(SUBJECT_SLUG);
});
