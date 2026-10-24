import { expect, type BrowserContext, type Page } from "@playwright/test";
import { manage } from "./manage";
import { makePdf } from "./pdf-fixture";

const API_URL = (process.env.E2E_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Dev backend yuborilgan email kodini `/dev/otp/` orqali ochiq qoldiradi (prod'da yo'q). */
export async function otpCodeFor(page: Page, email: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${API_URL}/api/v1/dev/otp/`, {
          params: { email },
        });
        code = response.ok() ? ((await response.json()) as { code: string }).code : undefined;
        return code;
      },
      { message: "OTP kodi dev inbox'da paydo bo'lmadi (backend dev sozlamasida ishlayaptimi?)" },
    )
    .toMatch(/^\d{6}$/);
  return code!;
}

/**
 * Email kodi bilan kiradi (hisob o'zi yaratiladi), onboarding'ni (9-sinf o'quvchi) tugatib kabinetga
 * tushadi. Alohida ro'yxatdan o'tish sahifasi yo'q: kirish sahifasi email → kod → onboarding.
 */
export async function registerByCode(page: Page, email: string, name = "E2E O'quvchi") {
  await page.goto("/uz/kirish");
  const step = page.getByTestId("email-step");
  // Gidratsiyadan oldingi bosish yo'qolishi mumkin — kod sahifasi ochilguncha takrorlanadi.
  await expect(async () => {
    if (/\/uz\/kod/.test(page.url())) return;
    await step.getByLabel("Email").fill(email);
    await step.getByRole("button", { name: /Kod yuborish/ }).click();
    await expect(page).toHaveURL(/\/uz\/kod\?email=/, { timeout: 3_000 });
  }).toPass();
  // Kataklar gidratsiyadan keyin fokus oladi — shundan keyin yozamiz.
  await expect(
    page.getByRole("group", { name: "Tasdiqlash kodi" }).getByRole("textbox").first(),
  ).toBeFocused();
  await page.keyboard.type(await otpCodeFor(page, email));

  await expect(page).toHaveURL(/\/uz\/onboarding$/);
  await page.getByLabel("Ismingiz").fill(name);
  await page.getByRole("combobox", { name: "Sinfingiz" }).click();
  await page.getByRole("option", { name: "9-sinf" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await expect(page).toHaveURL(/\/uz\/kabinet$/);
}

/** `registerByCode` + sozlamalarda parol o'rnatish: keyin `signIn` (email + parol) ishlaydi. */
export async function register(page: Page, email: string, password: string, name?: string) {
  await registerByCode(page, email, name);
  await page.goto("/uz/sozlamalar");
  const setPassword = page.getByTestId("set-password");
  await setPassword.getByLabel("Yangi parol").fill(password);
  await setPassword.getByLabel("Parolni takrorlang").fill(password);
  await setPassword.getByRole("button", { name: "Parolni o'rnatish" }).click();
  await expect(page.getByTestId("linked-identities").getByText("Email va parol")).toBeVisible();
  await page.goto("/uz/kabinet");
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
    await step.getByRole("button", { name: "Parol bilan kirish" }).click();
    await expect(form).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await form.getByLabel("Parol", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Kirish" }).click();
  await expect(page).toHaveURL(/\/uz\/(kabinet|ustoz|admin)$/);
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
  await page.getByTestId("pdf-grade-9").filter({ visible: true }).click();
  await next.click();
  await page.getByTestId("pdf-subject-algebra").click();
  await next.click();
  await page.getByLabel("O'zbekcha (majburiy)").fill(options.title);
  await page.getByTestId("pdf-input").setInputFiles({
    name: "kitob.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(options.pages),
  });
  await next.click(); // Tavsif va mundarija qadami (ixtiyoriy)
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
