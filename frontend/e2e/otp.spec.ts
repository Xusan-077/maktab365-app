import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

/** Dev backend yuborilgan kodni `OTP_DEV_INBOX` orqali ochiq qoldiradi (prod'da yo'q). */
async function codeFor(request: APIRequestContext, email: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${API_URL}/api/v1/dev/otp/`, { params: { email } });
        code = response.ok() ? ((await response.json()) as { code: string }).code : undefined;
        return code;
      },
      { message: "OTP kodi dev inbox'da paydo bo'lmadi (backend dev sozlamasida ishlayaptimi?)" },
    )
    .toMatch(/^\d{6}$/);
  return code!;
}

/** Kirish sahifasi: email → "Davom etish" → "Parolsiz: kodni emailga yuborish". */
async function requestCode(page: Page, email: string) {
  const step = page.getByTestId("email-step");
  await step.getByLabel("Email").fill(email);
  await step.getByRole("button", { name: "Davom etish" }).click();
  await page.getByRole("button", { name: "Parolsiz: kodni emailga yuborish" }).click();
}

test.describe("email kodi bilan kirish", () => {
  test("kod so'rash → 6 katak → onboarding", async ({ page, request }) => {
    const email = `otp-${Date.now()}@example.com`;
    await page.goto("/uz/kirish");
    await requestCode(page, email);

    await expect(page).toHaveURL(/\/uz\/kod\?email=/);
    await expect(page.getByText(`${email} manziliga`)).toBeVisible();
    // Birinchi katakka avtomatik fokus; qayta yuborish taymer tugamaguncha o'chiq.
    const cells = page.getByRole("group", { name: "Tasdiqlash kodi" }).getByRole("textbox");
    await expect(cells.first()).toBeFocused();
    await expect(page.getByRole("button", { name: /Qayta yuborish: \d+ soniya/ })).toBeDisabled();

    // Noto'g'ri kod: xabar, kataklar tozalanadi.
    const code = await codeFor(request, email);
    const wrong = code === "000000" ? "111111" : "000000";
    await page.keyboard.type(wrong);
    await expect(page.getByText("Kod noto'g'ri")).toBeVisible();
    await expect(cells.first()).toBeFocused();

    await page.keyboard.type(code);
    await expect(page).toHaveURL(/\/uz\/onboarding$/);
    // Kod egalikni isbotladi: tasdiqlanmagan email banneri kerak emas.
    await page.getByLabel("Ismingiz").fill("OTP O'quvchi");
    await page.getByRole("combobox", { name: "Sinfingiz" }).click();
    await page.getByRole("option", { name: "8-sinf" }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page).toHaveURL(/\/uz\/kabinet$/);
    await expect(page.getByTestId("email-verify-banner")).toHaveCount(0);
  });

  test("Sozlamalar → Xavfsizlik: ulangan usullar, parol o'rnatish, oxirgisi o'chmaydi", async ({
    page,
    request,
  }) => {
    const email = `otp-set-${Date.now()}@example.com`;
    await page.goto("/uz/kirish");
    await requestCode(page, email);
    await expect(page).toHaveURL(/\/uz\/kod\?email=/);
    // Kataklar gidratsiyadan keyin fokus oladi — shundan keyin yozamiz.
    await expect(
      page.getByRole("group", { name: "Tasdiqlash kodi" }).getByRole("textbox").first(),
    ).toBeFocused();
    await page.keyboard.type(await codeFor(request, email));
    await expect(page).toHaveURL(/\/uz\/onboarding$/);
    await page.getByLabel("Ismingiz").fill("OTP Sozlama");
    await page.getByRole("combobox", { name: "Sinfingiz" }).click();
    await page.getByRole("option", { name: "7-sinf" }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page).toHaveURL(/\/uz\/kabinet$/);

    await page.goto("/uz/sozlamalar");
    const methods = page.getByTestId("linked-identities");
    await expect(methods.getByText("Email kodi")).toBeVisible();
    // Yagona usul: o'chirish tugmasi o'chiq.
    await expect(methods.getByRole("button", { name: "O'chirish" })).toBeDisabled();
    // Parolsiz akkaunt → parol o'rnatish formasi (almashtirish emas).
    const setPassword = page.getByTestId("set-password");
    await expect(setPassword).toBeVisible();
    await setPassword.getByLabel("Yangi parol").fill("otp-yangi-parol-2026");
    await setPassword.getByLabel("Parolni takrorlang").fill("otp-yangi-parol-2026");
    await setPassword.getByRole("button", { name: "Parolni o'rnatish" }).click();

    await expect(methods.getByText("Email va parol")).toBeVisible();
    await expect(setPassword).toHaveCount(0);
    // Endi ikkita usul bor — o'chirish yoqildi.
    await expect(methods.getByRole("button", { name: "O'chirish" }).first()).toBeEnabled();
  });

  test("Telegram tugmasi konteyneri kirish sahifasida bor", async ({ page }) => {
    await page.goto("/uz/kirish");
    await expect(page.getByTestId("telegram-login")).toBeAttached();
    await expect(page.getByRole("button", { name: "Google bilan davom etish" })).toBeVisible();
  });
});
