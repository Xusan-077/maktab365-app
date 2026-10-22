import { expect, type BrowserContext, type Page } from "@playwright/test";
import { manage } from "./manage";
import { makePdf } from "./pdf-fixture";

/** Ro'yxatdan o'tadi va onboarding'ni (9-sinf o'quvchi) tugatib kabinetga tushadi. */
export async function register(page: Page, email: string, password: string) {
  await page.goto("/uz/royxatdan-otish");
  const form = page.getByTestId("register-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Parol", { exact: true }).fill(password);
  await form.getByLabel("Parolni takrorlang").fill(password);
  await form.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();

  await expect(page).toHaveURL(/\/uz\/onboarding$/);
  await page.getByLabel("Ismingiz").fill("E2E O'quvchi");
  await page.getByRole("combobox", { name: "Sinfingiz" }).click();
  await page.getByRole("option", { name: "9-sinf" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await expect(page).toHaveURL(/\/uz\/kabinet$/);
}

export async function signIn(page: Page, email: string, password: string) {
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

/**
 * Admin yaratadi (ro'yxatdan o'tadi, `create_admin` rol beradi), PDF yuklaydi va nashr qiladi.
 * Kitob id'sini qaytaradi.
 */
export async function publishBook(
  page: Page,
  context: BrowserContext,
  options: { email: string; password: string; title: string; pages: number },
): Promise<string> {
  await register(page, options.email, options.password);
  manage(["create_admin"], { ADMIN_EMAIL: options.email, ADMIN_PASSWORD: options.password });
  await context.clearCookies();
  await signIn(page, options.email, options.password);

  await page.goto("/uz/admin/kitoblar/yangi");
  const next = page.getByRole("button", { name: "Davom etish" });
  await page.getByTestId("pdf-grade-9").click();
  await next.click();
  await page.getByTestId("pdf-subject-algebra").click();
  await next.click();
  await page.getByLabel("O'zbekcha (majburiy)").fill(options.title);
  await page.getByTestId("pdf-input").setInputFiles({
    name: "kitob.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(options.pages),
  });
  await page.getByRole("button", { name: "Yuklash va saqlash" }).click();

  await expect(page).toHaveURL(/\/uz\/admin\/kitoblar\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const bookId = new URL(page.url()).pathname.split("/").pop()!;
  await page.getByRole("button", { name: "Nashr qilish" }).click();
  await expect(page.getByRole("button", { name: "Yashirish" })).toBeVisible();
  return bookId;
}

/** Brauzerdan backend'ga BFF orqali GET (sessiya cookie bilan). */
export async function apiGet<T>(page: Page, path: string): Promise<T | null> {
  const response = await page.request.get(`/api/backend/api/v1${path}`);
  return response.ok() ? ((await response.json()) as T) : null;
}
