import { expect, test, type Page } from "@playwright/test";

/**
 * O'qish jarayoni (M8): mehmon o'qiydi va xatcho'p qo'yadi → ro'yxatdan o'tgach ma'lumot akkauntda →
 * boshqa brauzerda kirib "Davom ettirish". Haqiqiy backend + import qilingan kontent.
 */
const TOPIC_TITLE = "Viyet teoremasi";
const TOPIC_URL = "/uz/darsliklar/algebra-9/algebra-9-viyet-teoremasi";
const email = `e2e-learning-${Date.now()}@example.com`;
const password = "e2e-kuchli-parol-2026";

const GUEST_KEY = "maktab365-guest";

async function register(page: Page) {
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

async function signIn(page: Page) {
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
  await expect(page).toHaveURL(/\/uz\/kabinet$/);
}

/** BFF orqali akkaunt progressi (brauzer sessiyasi bilan). */
async function accountProgress(page: Page) {
  const response = await page.request.get("/api/backend/api/v1/me/progress");
  expect(response.ok()).toBe(true);
  return (await response.json()) as Array<{
    topic_id: string;
    read_status: string;
    last_block_id: string;
  }>;
}

test("mehmon o'qiydi + xatcho'p → kirgach akkauntda → boshqa brauzerda davom ettirish", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Mehmon: mavzuni ochadi, xatcho'p qo'yadi, o'qigan joyigacha aylantiradi va "o'qidim" bosadi.
  await page.goto(TOPIC_URL);
  await expect(page.getByRole("heading", { level: 1, name: TOPIC_TITLE })).toBeVisible();

  const bookmark = page.getByRole("button", { name: "Xatcho'pga qo'shish" });
  // Gidratsiyadan oldingi bosish yo'qolishi mumkin — holat o'zgarguncha takrorlanadi.
  await expect(async () => {
    if (await page.getByRole("button", { name: "Xatcho'pda" }).isVisible()) return;
    await bookmark.click({ timeout: 1_000 });
    await expect(page.getByRole("button", { name: "Xatcho'pda" })).toBeVisible({ timeout: 1_000 });
  }).toPass();

  await page.locator("#section-exercise").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Mavzuni o'qidim" }).click();
  await expect(page.getByText("Mavzu o'qilgan deb belgilandi")).toBeVisible();

  // Mehmon ma'lumoti qurilmada: o'qish va xatcho'p.
  await expect
    .poll(async () => page.evaluate((key) => localStorage.getItem(key) ?? "", GUEST_KEY))
    .toContain('"bookmarks":["algebra-9-viyet-teoremasi"]');
  await expect
    .poll(async () => page.evaluate((key) => localStorage.getItem(key) ?? "", GUEST_KEY))
    .toContain('"readStatus":"completed"');

  // 2. Ro'yxatdan o'tadi: mehmon ma'lumoti avtomatik akkauntga qo'shiladi.
  await register(page);
  await expect(page.getByText("Mehmon ma'lumotlari akkauntga qo'shildi")).toBeVisible();
  await expect
    .poll(async () => (await accountProgress(page)).map((item) => item.topic_id))
    .toContain("algebra-9-viyet-teoremasi");
  const [saved] = await accountProgress(page);
  expect(saved.read_status).toBe("read");

  // Mehmon store'i tozalangan
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_KEY)).toContain(
    '"progress":{}',
  );

  // Kabinet serverdan: davom ettirish kartochkasi va saqlanganlar
  await page.goto("/uz/kabinet");
  await expect(
    page.getByRole("link", { name: `${TOPIC_TITLE} mavzusini davom ettirish` }),
  ).toBeVisible();
  await page.goto("/uz/kabinet/saqlanganlar");
  await expect(page.getByRole("link", { name: TOPIC_TITLE })).toBeVisible();

  // 3. Boshqa brauzer (yangi kontekst, bo'sh localStorage): kirib, "Davom ettirish".
  const other = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    locale: "uz",
  });
  try {
    const second = await other.newPage();
    await signIn(second);
    const resume = second.getByRole("link", {
      name: `${TOPIC_TITLE} mavzusini davom ettirish`,
    });
    await expect(resume).toBeVisible();
    await expect(second.getByText("Mavzuni o'qidim").first()).toBeVisible();
    await resume.click();
    await expect(second).toHaveURL(/\/algebra-9-viyet-teoremasi/);
    await expect(second.getByRole("heading", { level: 1, name: TOPIC_TITLE })).toBeVisible();
    // Boshqa brauzerda ham xatcho'p serverdan
    await expect(second.getByRole("button", { name: "Xatcho'pda" })).toBeVisible();
  } finally {
    await other.close();
  }
});
