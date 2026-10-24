import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";
import { register as registerUser, signIn } from "./helpers";
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
    await registerUser(page, adminEmail, userPassword);
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
    // Yangi kitob "avtomatik" muqova rejimida: tayyor (CSS) muqova, rasm yo'q.
    await expect(
      page.getByTestId("cover-section").getByRole("radio", { name: /Avtomatik/ }),
    ).toBeChecked();

    // --- Nashr: yashirin → ochiq.
    await page.getByRole("button", { name: "Nashr qilish" }).click();
    await expect(page.getByRole("button", { name: "Yashirish" })).toBeVisible();
    await page.goto("/uz/admin/kitoblar");
    await expect(page.getByTestId("pdf-books-table")).toContainText(TITLE);
  });

  test("o'quvchi: katalogdan topadi, 5-sahifaga o'tadi, sahifa URL va progressda saqlanadi", async ({
    page,
  }) => {
    await registerUser(page, studentEmail, userPassword);

    await page.goto("/uz/darsliklar?sinf=9&fan=algebra");
    const card = page
      .getByTestId("pdf-book-card")
      .filter({ hasText: TITLE })
      .filter({ visible: true });
    await card.click();

    // --- Kitob sahifasidan o'qish oynasiga o'tadi.
    await expect(page).toHaveURL(/\/uz\/darsliklar\/9\/[^/]+$/);
    await page.getByRole("link", { name: "Onlayn o'qish" }).click();

    // --- Ochilganda 1-sahifa, URL'da ?page=1, «1 / 8».
    await expect(page).toHaveURL(/\/oqish\?page=1$/);
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
    await page.goto("/uz/darsliklar?sinf=9");
    await expect(page.getByRole("link").filter({ hasText: TITLE })).toContainText("5-bet");

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
    await registerUser(page, guestEmail, userPassword);
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
    await expect(page).toHaveURL(/\/oqish\?page=3$/);

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
    await expect(page.getByTestId("pdf-book-card").filter({ hasText: TITLE })).toHaveCount(1);
    await expect(page.getByRole("searchbox", { name: "Darslik qidirish" })).toHaveValue(TITLE);

    await page.goto("/uz/darsliklar?q=mavjud-bo'lmagan-kitob");
    await expect(page.getByRole("status")).toContainText("Darslik topilmadi");

    await signIn(page, studentEmail, userPassword);
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("searchbox").fill(TITLE);
    await page
      .getByRole("dialog")
      .getByRole("link", { name: new RegExp(TITLE) })
      .click();
    await expect(page).toHaveURL(/\/uz\/darsliklar\/\d+\/[^/]+(\/oqish)?$/);
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
    await expect(page).toHaveURL(/\/uz\/darsliklar\/\d+\/[^/]+\/oqish$/);
    await page.goto("/uz/fanlar/algebra");
    await expect(page).toHaveURL(/\/uz\/darsliklar\?fan=algebra$/);
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
