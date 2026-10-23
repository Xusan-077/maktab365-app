import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";
import { manage } from "./manage";
import { makePdf } from "./pdf-fixture";

/**
 * PDF darsliklar: admin PDF yuklaydi (muqova 1-sahifadan) → nashr qiladi → o'quvchi katalogdan
 * topib ochadi → 5-sahifaga o'tadi → sahifa URL'da va progressda saqlanadi. Mehmon pozitsiyasi
 * ro'yxatdan o'tganda akkauntga qo'shiladi.
 *
 * Hisob ma'lumotlari har ishga tushirishda tasodifiy yaratiladi: kodda parol yo'q.
 */
const stamp = Date.now();
const adminEmail = `e2e-pdf-admin-${stamp}@example.com`;
const adminPassword = randomPassword();
const studentEmail = `e2e-pdf-student-${stamp}@example.com`;
const guestEmail = `e2e-pdf-guest-${stamp}@example.com`;
const userPassword = randomPassword();
const TITLE = `E2E PDF Algebra ${stamp}`;
const PAGES = 8;
const DESCRIPTION = `E2E tavsif ${stamp}`;

let bookId = "";

async function register(page: Page, email: string) {
  await page.goto("/uz/royxatdan-otish");
  const form = page.getByTestId("register-form");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Parol", { exact: true }).fill(userPassword);
  await form.getByLabel("Parolni takrorlang").fill(userPassword);
  await form.getByRole("button", { name: "Ro'yxatdan o'tish" }).click();

  await expect(page).toHaveURL(/\/uz\/onboarding$/);
  await page.getByLabel("Ismingiz").fill("E2E O'quvchi");
  await page.getByRole("combobox", { name: "Sinfingiz" }).click();
  await page.getByRole("option", { name: "9-sinf" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await expect(page).toHaveURL(/\/uz\/kabinet$/);
}

async function signIn(page: Page, email: string, password: string) {
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
  await expect(page).toHaveURL(/\/uz\/(kabinet|ustoz|admin)$/);
}

/** Server tomonda saqlangan oxirgi sahifa (BFF orqali, sessiya cookie bilan). */
async function savedPage(page: Page): Promise<number | null> {
  const response = await page.request.get(`/api/backend/api/v1/me/pdf-progress/${bookId}`);
  return response.ok() ? ((await response.json()) as { last_page: number }).last_page : null;
}

/** Serverda saqlangan kitoblar (BFF orqali, sessiya cookie bilan). */
async function savedBookIds(page: Page): Promise<string[]> {
  const response = await page.request.get("/api/backend/api/v1/me/pdf-bookmarks/");
  if (!response.ok()) return [];
  return ((await response.json()) as { book: { id: string } }[]).map((row) => row.book.id);
}

test.describe.serial("PDF darsliklar", () => {
  test("admin: PDF yuklaydi, muqova yaratiladi va kitobni nashr qiladi", async ({
    page,
    context,
  }) => {
    // Akkaunt onboarding'dan o'tadi, so'ng `create_admin` unga admin rolini beradi va parolni
    // (tasodifiy, env orqali) o'rnatadi; eski sessiyada rol yo'q — qayta kiriladi.
    await register(page, adminEmail);
    manage(["create_admin"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword });
    await context.clearCookies();
    await signIn(page, adminEmail, adminPassword);

    // --- Sinf → fan → nom va PDF (ketma-ket qadamlar).
    await page.goto("/uz/admin/kitoblar");
    await expect(page.getByRole("navigation", { name: "Admin menyusi" })).toContainText("Kitoblar");
    await page.getByRole("link", { name: "PDF kitob qo'shish" }).first().click();
    await expect(page).toHaveURL(/\/uz\/admin\/kitoblar\/yangi$/);

    const next = page.getByRole("button", { name: "Davom etish" });
    await expect(next).toBeDisabled(); // sinf tanlanmaguncha
    await page.getByTestId("pdf-grade-9").click();
    await next.click();
    await page.getByTestId("pdf-subject-algebra").click();
    await next.click();

    await page.getByLabel("O'zbekcha (majburiy)").fill(TITLE);
    await page.getByTestId("pdf-input").setInputFiles({
      name: "algebra.pdf",
      mimeType: "application/pdf",
      buffer: makePdf(PAGES),
    });
    await expect(page.getByTestId("pdf-selected")).toContainText("algebra.pdf");
    await next.click();

    // --- Tavsif va mundarija (ixtiyoriy qadam): tavsif, 2 ta bo'lim va ommaviy kiritish.
    await page.getByTestId("pdf-description-input").fill(DESCRIPTION);
    await page.getByTestId("toc-add").click();
    await page.getByTestId("toc-title").nth(0).fill("Kirish");
    await page.getByTestId("toc-page").nth(0).fill("1");
    await page.getByTestId("toc-bulk").locator("summary").click();
    await page.getByTestId("toc-bulk").getByRole("textbox").fill("2. Algebra ........ 3");
    await page.getByRole("button", { name: "Jadvalga to'ldirish" }).click();
    await expect(page.getByTestId("toc-title")).toHaveCount(2);
    await page.getByRole("button", { name: "Yuklash va saqlash" }).click();

    // --- Yuklangach kitob sahifasiga o'tadi: betlar soni aniqlangan, muqova 1-sahifadan.
    await expect(page).toHaveURL(/\/uz\/admin\/kitoblar\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    bookId = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
    await expect(page.getByTestId("pdf-details")).toContainText(String(PAGES));
    // Tavsif va mundarija PDF yuklangach saqlangan: tahrirlash formasida turibdi.
    const detailsForm = page.getByTestId("pdf-details-form");
    await expect(detailsForm.getByTestId("pdf-description-input")).toHaveValue(DESCRIPTION);
    await expect(detailsForm.getByTestId("toc-title")).toHaveCount(2);

    // --- Bet PDF dan katta bo'lsa saqlanmaydi (mijoz tekshiruvi).
    await detailsForm
      .getByTestId("toc-page")
      .nth(1)
      .fill(String(PAGES + 1));
    await detailsForm.getByRole("button", { name: "Saqlash" }).click();
    await expect(detailsForm.getByText(`PDF betlaridan oshmasin (${PAGES} bet)`)).toBeVisible();
    await detailsForm.getByTestId("toc-page").nth(1).fill("2");
    await detailsForm.getByRole("button", { name: "Saqlash" }).click();
    await expect(detailsForm.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    await expect(page.getByTestId("pdf-cover")).toBeVisible();
    await expect
      .poll(() =>
        page.getByTestId("pdf-cover").evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);

    // --- Nashr: yashirin → ochiq.
    await page.getByRole("button", { name: "Nashr qilish" }).click();
    await expect(page.getByRole("button", { name: "Yashirish" })).toBeVisible();
    await page.goto("/uz/admin/kitoblar");
    await expect(page.getByTestId("pdf-books-table")).toContainText(TITLE);
  });

  test("o'quvchi: katalogdan topadi, 5-sahifaga o'tadi, sahifa URL va progressda saqlanadi", async ({
    page,
  }) => {
    await register(page, studentEmail);

    await page.goto("/uz/darsliklar");
    await page.getByTestId("pdf-grade-9").click();
    await page.getByTestId("pdf-subject-algebra").click();
    const card = page.getByTestId("pdf-book-card").filter({ hasText: TITLE });
    await expect(card).toContainText(`${PAGES} bet`);
    await card.click();

    // --- Ochilganda 1-sahifa, URL'da ?page=1, «1 / 8».
    await expect(page).toHaveURL(new RegExp(`/uz/darsliklar/${bookId}\\?page=1$`));
    await expect(page.getByTestId("pdf-canvas")).toBeVisible();
    await expect(page.getByTestId("pdf-page-total")).toHaveText(`/ ${PAGES}`);

    // --- Tavsif ko'rinadi; mundarija paneli bo'limni bossa shu betga o'tkazadi.
    await expect(page.getByTestId("pdf-description")).toContainText(DESCRIPTION);
    await page.getByTestId("pdf-toc-open").click();
    const items = page.getByTestId("pdf-toc-item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute("aria-current", "location");
    await items.nth(1).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "2");

    // --- Raqam kiritib 5-sahifaga o'tish.
    const input = page.getByTestId("pdf-page-input");
    await input.fill("5");
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`\\?page=5$`));
    await expect(input).toHaveValue("5");
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "5");

    // --- Chegaradan tashqari qiymat tuzatiladi; klaviatura va tugmalar.
    await input.fill("999");
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`\\?page=${PAGES}$`));
    await input.fill("0");
    await input.press("Enter");
    await expect(page).toHaveURL(/\?page=1$/);
    await input.fill("5");
    await input.press("Enter");
    await expect(page).toHaveURL(/\?page=5$/);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\?page=6$/);
    await page.getByTestId("pdf-prev").click();
    await expect(page).toHaveURL(/\?page=5$/);

    // --- Progress serverda saqlandi (debounce'dan keyin).
    await expect.poll(() => savedPage(page), { timeout: 15_000 }).toBe(5);

    // --- Qayta ochilganda (sahifasiz URL) 5-sahifadan davom etadi; katalogda belgi bor.
    await page.goto(`/uz/darsliklar/${bookId}`);
    await expect(page).toHaveURL(/\?page=5$/);
    await expect(page.getByTestId("pdf-page-input")).toHaveValue("5");
    await page.goto("/uz/darsliklar?grade=9");
    await expect(page.getByTestId("pdf-book-card").filter({ hasText: TITLE })).toContainText(
      "5-betdan davom etish",
    );

    // --- URL'dagi sahifa saqlangandan ustun.
    await page.goto(`/uz/darsliklar/${bookId}?page=2`);
    await expect(page.getByTestId("pdf-page-input")).toHaveValue("2");
  });

  test("mehmon pozitsiyasi ro'yxatdan o'tganda akkauntga qo'shiladi", async ({ page }) => {
    // Mehmon: 4-sahifagacha o'qiydi (brauzerda saqlanadi).
    await page.goto(`/uz/darsliklar/${bookId}?page=4`);
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "4");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("maktab365-guest-pdf")))
      .toContain(bookId);
    // Mehmon kitobni saqlaydi (brauzerda turadi).
    await page.getByTestId("pdf-bookmark").click();
    await expect(page.getByTestId("pdf-bookmark")).toHaveAttribute("aria-pressed", "true");

    // Ro'yxatdan o'tgach guest merge pozitsiyani va saqlangan kitobni akkauntga yozadi.
    await register(page, guestEmail);
    await expect.poll(() => savedPage(page), { timeout: 20_000 }).toBe(4);
    await expect.poll(() => savedBookIds(page), { timeout: 20_000 }).toContain(bookId);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("maktab365-guest-pdf")))
      .not.toContain(bookId);

    // Kitob 4-sahifadan ochiladi, saqlangan holda.
    await page.goto(`/uz/darsliklar/${bookId}`);
    await expect(page).toHaveURL(/\?page=4$/);
    await expect(page.getByTestId("pdf-bookmark")).toHaveAttribute("aria-pressed", "true");
  });

  test("o'quvchi: saqlaydi, kabinetda 'Davom ettirish' va 'Saqlanganlar' ko'rinadi", async ({
    page,
  }) => {
    await signIn(page, studentEmail, userPassword);
    await page.goto(`/uz/darsliklar/${bookId}?page=3`);
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "3");
    await page.getByTestId("pdf-bookmark").click();
    await expect.poll(() => savedBookIds(page)).toContain(bookId);
    await expect.poll(() => savedPage(page), { timeout: 15_000 }).toBe(3);

    // Kabinet: oxirgi ochilgan kitob shu betga qaytaradi.
    await page.goto("/uz/kabinet");
    const card = page.getByTestId("continue-card");
    await expect(card).toContainText(TITLE);
    await expect(card).toContainText(`3 / ${PAGES}`);
    await card.getByRole("link", { name: "Davom ettirish" }).click();
    await expect(page).toHaveURL(new RegExp(`/uz/darsliklar/${bookId}\\?page=3$`));

    // Saqlanganlar; o'quvchi menyusi: Bosh sahifa, Darsliklar, Fanlarim, Natijalar, Saqlanganlar.
    await page.goto("/uz/kabinet/saqlanganlar");
    await expect(page.getByTestId("saved-books")).toContainText(TITLE);
    const menu = page
      .locator("[data-app-sidebar]")
      .getByRole("navigation", { name: "Panel menyusi" });
    await expect(menu.getByRole("link")).toHaveText([
      "Bosh sahifa",
      "Darsliklar",
      "Fanlarim",
      "Natijalar",
      "Saqlanganlar",
    ]);

    // Saqlashni bekor qilish.
    await page.goto(`/uz/darsliklar/${bookId}`);
    await page.getByTestId("pdf-bookmark").click();
    await expect.poll(() => savedBookIds(page)).not.toContain(bookId);
  });

  test("qidiruv: katalogda nom bo'yicha va Ctrl+K orqali", async ({ page }) => {
    await page.goto(`/uz/darsliklar?q=${encodeURIComponent(TITLE)}`);
    await expect(page.getByTestId("pdf-book-card")).toHaveCount(1);
    await expect(page.getByTestId("pdf-search")).toHaveValue(TITLE);

    await page.goto("/uz/darsliklar?q=mavjud-bo'lmagan-kitob");
    await expect(page.getByTestId("pdf-book-card")).toHaveCount(0);

    await signIn(page, studentEmail, userPassword);
    await page.keyboard.press("Control+k");
    await page.getByLabel("Darslik qidirish").fill(TITLE);
    await page
      .getByRole("dialog")
      .getByRole("link", { name: new RegExp(TITLE) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/uz/darsliklar/${bookId}`));
  });

  test("viewer'dan xato yuboriladi va yordam sahifasida ko'rinadi", async ({ page }) => {
    await signIn(page, studentEmail, userPassword);
    await page.goto(`/uz/darsliklar/${bookId}?page=2`);
    await page.getByRole("button", { name: "Xato topdingizmi?" }).click();
    const dialog = page.getByRole("dialog", { name: "Xato haqida xabar" });
    await dialog.getByLabel("Xabaringiz").fill("Ikkinchi betdagi rasm noto'g'ri joylashgan.");
    await dialog.getByRole("button", { name: "Yuborish" }).click();
    await expect(dialog.getByTestId("support-sent")).toBeVisible();

    await page.goto("/uz/kabinet/yordam");
    await expect(page.getByTestId("my-support")).toContainText("Ikkinchi betdagi rasm");
  });

  test("eski manzillar yangi joyga yo'naltiriladi", async ({ page }) => {
    await page.goto(`/uz/pdf-kitoblar/${bookId}`);
    await expect(page).toHaveURL(new RegExp(`/uz/darsliklar/${bookId}`));
    await page.goto("/uz/fanlar/algebra");
    await expect(page).toHaveURL(/\/uz\/darsliklar\?subject=algebra$/);
    await page.goto("/uz/darsliklar/algebra-9/diskriminant");
    await expect(page).toHaveURL(/\/uz\/darsliklar$/);
    await page.goto("/uz/darsliklar/algebra-9");
    await expect(page).toHaveURL(/\/uz\/darsliklar$/);
    await page.goto("/uz/admin/pdf-kitoblar");
    await expect(page).toHaveURL(/\/uz\/(admin\/kitoblar|kirish)/);
  });

  test("oddiy foydalanuvchi admin PDF API'siga kira olmaydi", async ({ page }) => {
    await signIn(page, studentEmail, userPassword);

    const list = await page.request.get("/api/backend/api/v1/admin/pdf-books");
    expect(list.status()).toBe(403);
    const upload = await page.request.post(
      `/api/backend/api/v1/admin/pdf-books/${bookId}/upload-init`,
      {
        data: { filename: "a.pdf", size: 10, content_type: "application/pdf" },
      },
    );
    expect(upload.status()).toBe(403);
    const publish = await page.request.post(
      `/api/backend/api/v1/admin/pdf-books/${bookId}/transition`,
      { data: { to: "draft" } },
    );
    expect(publish.status()).toBe(403);
    await page.goto("/uz/admin/kitoblar");
    await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();
  });
});
