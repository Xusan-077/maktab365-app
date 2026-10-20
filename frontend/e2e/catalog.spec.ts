import { expect, test, type Page } from "@playwright/test";

/**
 * Haqiqiy backend + import qilingan kontent (`global-setup.ts`): bosh sahifa → katalog filtri →
 * kitob → mavzu → mashq; qidiruv lotin va kirill yozuvida.
 */
test("bosh sahifa → katalog → kitob → mavzu → mashq", async ({ page }) => {
  await page.goto("/uz");

  await page
    .getByRole("group", { name: "Sinflar" })
    .getByRole("button", { name: "9-sinf" })
    .click();
  await page.getByRole("link", { name: "Algebra", exact: true }).click();

  // Katalog: fan va sinf filtri URL'dan o'qiladi.
  await expect(page).toHaveURL(/\/uz\/darsliklar\?.*subject=algebra/);
  const bookLink = page.getByRole("link", { name: "Algebra. 9-sinf" }).first();
  await expect(bookLink).toBeVisible();
  await expect(page.getByRole("link", { name: "Geometriya. 9-sinf" })).toHaveCount(0);
  await bookLink.click();

  await expect(page).toHaveURL(/\/uz\/darsliklar\/algebra-9$/);
  await page.getByRole("link", { name: "Viyet teoremasi" }).first().click();

  // Mavzu sahifasi: backend bloklari, "Tekshiruvdan o'tmagan" belgisi (unverified).
  await expect(page).toHaveURL(/\/uz\/darsliklar\/algebra-9\/algebra-9-viyet-teoremasi$/);
  await expect(page.getByRole("heading", { level: 1, name: "Viyet teoremasi" })).toBeVisible();
  await expect(page.getByText("Tekshiruvdan o'tmagan").first()).toBeVisible();

  // Birinchi mashq (tanlov): to'g'ri javob — "7".
  const exercise = page.locator("#section-exercise form").first();
  await exercise.getByLabel("7", { exact: true }).check();
  await exercise.getByRole("button", { name: "Tekshirish" }).click();
  await expect(exercise.getByText("To'g'ri! Barakalla.")).toBeVisible();
});

test.describe("qidiruv", () => {
  async function search(page: Page, query: string) {
    await page.goto("/uz/darsliklar");
    await page.getByRole("searchbox", { name: "Kitob yoki mavzu qidirish" }).fill(query);
  }

  test("lotin yozuvi: mavzu va snippet", async ({ page }) => {
    await search(page, "diskriminant");
    const hits = page.getByRole("region", { name: "Topilgan mavzular" });
    await expect(hits.getByRole("link", { name: "Diskriminant va ildizlar" })).toBeVisible();
    await expect(hits.locator("mark").first()).toContainText(/diskriminant/i);
  });

  test("kirill yozuvi lotin kontentni topadi", async ({ page }) => {
    await search(page, "дискриминант");
    const hits = page.getByRole("region", { name: "Topilgan mavzular" });
    await expect(hits.getByRole("link", { name: "Diskriminant va ildizlar" })).toBeVisible();
    await expect(hits.locator("mark").first()).toBeVisible();
  });

  test("tutuq belgisiz va kirill: O'zbekiston ≈ ўзбекистон", async ({ page }) => {
    await search(page, "ўзбекистон");
    await expect(
      page.getByRole("region", { name: "Topilgan mavzular" }).getByRole("link").first(),
    ).toBeVisible();
  });
});
