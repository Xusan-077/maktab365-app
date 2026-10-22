import { expect, test, type Page } from "@playwright/test";
import { randomPassword } from "./credentials";
import { apiGet, publishBook, register, signIn } from "./helpers";

/**
 * O'qish jarayoni (M8): mehmon o'qiydi va saqlaydi → ro'yxatdan o'tadi → ma'lumot akkauntda;
 * boshqa brauzerda kirib "Davom ettirish" o'sha betga olib boradi; oxirigacha o'qish natijalarda
 * "o'qilgan" bo'ladi; rejalar; offline yozuv navbatga tushib, internet qaytganda yuboriladi.
 *
 * Hisoblar har ishga tushirishda tasodifiy yaratiladi: kodda parol yo'q.
 */
const stamp = Date.now();
const adminEmail = `e2e-learn-admin-${stamp}@example.com`;
const readerEmail = `e2e-learn-reader-${stamp}@example.com`;
const password = randomPassword();
const adminPassword = randomPassword();
const TITLE = `E2E O'qish ${stamp}`;
const PAGES = 6;

let bookId = "";

const savedPage = async (page: Page) =>
  (await apiGet<{ last_page: number }>(page, `/me/pdf-progress/${bookId}`))?.last_page ?? null;

test.describe.serial("O'qish jarayoni", () => {
  test("admin kitobni nashr qiladi", async ({ page, context }) => {
    bookId = await publishBook(page, context, {
      email: adminEmail,
      password: adminPassword,
      title: TITLE,
      pages: PAGES,
    });
    expect(bookId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("mehmon o'qiydi va saqlaydi → kirgach ma'lumot akkauntda", async ({ page }) => {
    await page.goto(`/uz/darsliklar/${bookId}?page=4`);
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "4");
    await page.getByTestId("pdf-bookmark").click();
    await expect(page.getByTestId("pdf-bookmark")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("maktab365-guest-pdf")))
      .toContain(bookId);

    await register(page, readerEmail, password);

    // Merge: sahifa va xatcho'p serverda, mehmon store'i tozalangan.
    await expect.poll(() => savedPage(page), { timeout: 20_000 }).toBe(4);
    await expect
      .poll(async () =>
        ((await apiGet<{ book: { id: string } }[]>(page, "/me/pdf-bookmarks/")) ?? []).map(
          (row) => row.book.id,
        ),
      )
      .toContain(bookId);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("maktab365-guest-pdf")))
      .not.toContain(bookId);

    // Kabinet bosh sahifasi dashboard'dan: davom ettirish + ko'rsatkichlar + fan.
    await page.goto("/uz/kabinet");
    await expect(page.getByTestId("continue-card")).toContainText(TITLE);
    await expect(page.getByTestId("continue-card")).toContainText(`4 / ${PAGES}`);
    await expect(page.getByTestId("stat-saved")).toHaveText("1");
    await expect(page.getByTestId("stat-week-opened")).toHaveText("1");
  });

  test("boshqa brauzerda kirib 'Davom ettirish' o'sha betga olib boradi", async ({ browser }) => {
    const context = await browser.newContext();
    const other = await context.newPage();
    try {
      await signIn(other, readerEmail, password);

      await other.goto("/uz/kabinet");
      const card = other.getByTestId("continue-card");
      await expect(card).toContainText(TITLE);
      await card.getByRole("link", { name: "Davom ettirish" }).click();

      await expect(other).toHaveURL(new RegExp(`/uz/darsliklar/${bookId}\\?page=4$`));
      await expect(other.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "4");

      // Saqlanganlar ham shu akkauntda.
      await other.goto("/uz/kabinet/saqlanganlar");
      await expect(other.getByTestId("saved-books")).toContainText(TITLE);
    } finally {
      await context.close();
    }
  });

  test("oxirigacha o'qish: natijalarda va katalogda 'O'qilgan'", async ({ page }) => {
    await signIn(page, readerEmail, password);
    await page.goto(`/uz/darsliklar/${bookId}?page=${PAGES - 1}`);
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", String(PAGES - 1));
    await page.getByTestId("pdf-next").click();
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", String(PAGES));

    await expect
      .poll(
        async () =>
          (await apiGet<{ read_status: string }>(page, `/me/pdf-progress/${bookId}`))?.read_status,
        { timeout: 15_000 },
      )
      .toBe("read");

    // Holat monoton: orqaga qaytsa ham "o'qilgan" qoladi.
    await page.getByTestId("pdf-prev").click();
    await expect.poll(() => savedPage(page), { timeout: 15_000 }).toBe(PAGES - 1);
    expect(
      (await apiGet<{ read_status: string }>(page, `/me/pdf-progress/${bookId}`))?.read_status,
    ).toBe("read");

    await page.goto("/uz/kabinet/natijalar");
    await expect(page.getByTestId("results-read")).toContainText(TITLE);

    await page.goto("/uz/darsliklar?grade=9");
    const card = page.getByTestId("pdf-book-card").filter({ hasText: TITLE });
    await expect(card.getByTestId("pdf-read-badge")).toHaveText("O'qilgan");

    // Menyuda yangi bo'limlar.
    await page.goto("/uz/kabinet/fanlar");
    await expect(page.getByTestId("subjects-list")).toContainText(/1 \/ \d+ o'qilgan/); // bazada boshqa algebra kitoblari ham bo'lishi mumkin
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
  });

  test("rejalar: qo'shish, bajarish, qayta yuklagach saqlanadi", async ({ page }) => {
    await signIn(page, readerEmail, password);
    await page.goto("/uz/kabinet");

    await page.getByLabel("Reja nomi").fill("Algebra 1-bobni tugatish");
    await page.getByRole("button", { name: "Qo'shish" }).click();
    const list = page.getByTestId("goals-list");
    await expect(list).toContainText("Algebra 1-bobni tugatish");
    await expect(page.getByTestId("stat-goals")).toHaveText("1");

    await list.getByRole("checkbox", { name: /bajarildi deb belgilash/ }).click();
    await expect(list.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("stat-goals")).toHaveText("0");

    await page.reload();
    await expect(page.getByTestId("goals-list").getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("offline: sahifa navbatga tushadi, internet qaytgach serverga yuboriladi", async ({
    page,
    context,
  }) => {
    await signIn(page, readerEmail, password);
    await page.goto(`/uz/darsliklar/${bookId}?page=2`);
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "2");
    await expect.poll(() => savedPage(page), { timeout: 15_000 }).toBe(2);

    await context.setOffline(true);
    await page.getByTestId("pdf-next").click(); // 3-bet
    await expect(page.getByTestId("pdf-canvas")).toHaveAttribute("data-page", "3");
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.entries(localStorage)
            .filter(([key]) => key.startsWith("maktab365-writes:"))
            .map(([, value]) => value)
            .join(""),
        ),
      )
      .toContain('"page":3');

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => savedPage(page), { timeout: 20_000 }).toBe(3);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.keys(localStorage).filter((key) => key.startsWith("maktab365-writes:")).length,
        ),
      )
      .toBe(0);
  });
});
