import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * `/games` → kirish modali → o'yin ekrani (mehmon). O'yin API'si brauzer darajasida mock qilinadi
 * (BFF `/api/backend/api/v1/games/*`): o'yinga tayyor mavzu (≥ 8 savol) bazada bo'lishi shart emas.
 */

const SLUG = "kasrlar-3f2a9c1d0b4e";
const topic = {
  id: "3f2a9c1d-0b4e-4c1a-9b7e-000000000001",
  slug: SLUG,
  title: "Kasrlarni qo'shish",
  subject: { slug: "matematika", title: { uz: "Matematika" } },
  grade: 5,
  textbook: {
    id: "7b1c0000-0000-4000-8000-000000000001",
    slug: "5-matematika",
    title: { uz: "Matematika 5" },
  },
  question_count: 13,
};
const second = {
  ...topic,
  id: "8a8a8a8a-1111-4c1a-9b7e-000000000002",
  slug: "ulush-8a8a8a8a1111",
  title: "Ulush va foiz",
  question_count: 24,
};
const question = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  text: { uz: `${n} + ${n} nechaga teng?` },
  image: null,
  difficulty: "easy",
  options: [0, 1, 2, 3].map((i) => ({
    id: `00000000-0000-4000-9000-0000000000${n}${i}`,
    text: { uz: String(n * 2 + i - 1) },
  })),
  answer_token: `token-${n}`,
});

async function mockGamesApi(page: Page) {
  const topicQueries: URLSearchParams[] = [];
  await page.route("**/api/backend/api/v1/games/topics?**", (route: Route) => {
    const query = new URL(route.request().url()).searchParams;
    topicQueries.push(query);
    const results = [topic, second].filter(
      (item) => !query.get("q") || item.title.toLowerCase().includes(query.get("q")!.toLowerCase()),
    );
    return route.fulfill({ json: { count: results.length, next: null, previous: null, results } });
  });
  await page.route(`**/api/backend/api/v1/games/topics/${SLUG}/questions?**`, (route) => {
    const count = Number(new URL(route.request().url()).searchParams.get("count"));
    return route.fulfill({
      json: {
        topic,
        questions: Array.from({ length: Math.min(count, 8) }, (_, i) => question(i + 1)),
      },
    });
  });
  await page.route("**/api/backend/api/v1/games/check", (route) => {
    const body = route.request().postDataJSON() as { option_id: string };
    // Har savolda B (2-variant) to'g'ri.
    const correctId = body.option_id.replace(/\d$/, "1");
    return route.fulfill({
      json: { correct: body.option_id === correctId, correct_option_id: correctId },
    });
  });
  return topicQueries;
}

test.describe("Interaktiv o'yinlar", () => {
  test("qidiruv va filtrlar URL bilan sinxron", async ({ page }) => {
    const queries = await mockGamesApi(page);
    await page.goto("/uz/games");
    await expect(
      page.getByRole("heading", { level: 1, name: "Interaktiv o'yinlar" }),
    ).toBeVisible();
    await expect(page.getByTestId("game-topics").locator(":scope > li")).toHaveCount(2);
    await expect(page.getByTestId("allowance-free")).toHaveText("Bepul 10 tadan 10 ta qoldi");

    await page.getByLabel("Mavzu qidirish").fill("ulush");
    await expect(page).toHaveURL(/\/uz\/games\?q=ulush$/);
    await expect(page.getByTestId("game-topics").locator(":scope > li")).toHaveCount(1);
    expect(queries.at(-1)?.get("q")).toBe("ulush");

    await page.getByRole("button", { name: "5-sinf", exact: true }).click();
    await expect(page).toHaveURL(/q=ulush&grade=5/);

    await page.getByLabel("Qidiruvni tozalash").click();
    await expect(page).toHaveURL(/\/uz\/games\?grade=5$/);
  });

  test("modal: o'yin tanlash, sozlash va o'yinni boshlash", async ({ page }) => {
    await mockGamesApi(page);
    await page.goto("/uz/games");
    await page.getByRole("button", { name: `«${topic.title}» mavzusida o'ynash` }).click();

    const modal = page.getByTestId("game-modal");
    await expect(modal.getByRole("heading", { name: "Qaysi o'yinni o'ynaymiz?" })).toBeVisible();
    await expect(modal.getByTestId("game-modal-step")).toHaveText("1-qadam / 2");
    await expect(modal.getByTestId("game-continue")).toBeDisabled();

    // Arqon tortish — faqat 2 jamoa.
    await modal.getByTestId("game-option-arqon-tortish").click();
    await modal.getByTestId("game-continue").click();
    await expect(modal.getByTestId("game-modal-step")).toHaveText("2-qadam / 2");
    await expect(modal.getByTestId("teams-1")).toBeDisabled();
    await expect(modal.getByTestId("teams-3")).toBeDisabled();
    await expect(modal.getByTestId("rope-only-two")).toBeVisible();
    // Mavzuda 13 savol: 16 va 24 o'chiq.
    await expect(modal.getByTestId("questions-16")).toBeDisabled();
    await expect(modal.getByTestId("questions-12")).toHaveAttribute("aria-pressed", "true");

    // Orqaga → boshqa o'yin; Esc yopadi.
    await modal.getByTestId("game-modal-back").click();
    await expect(modal.getByTestId("game-modal-step")).toHaveText("1-qadam / 2");
    await page.keyboard.press("Escape");
    await expect(modal.getByTestId("game-pick")).toHaveCount(0);

    await page.getByRole("button", { name: `«${topic.title}» mavzusida o'ynash` }).click();
    await modal.getByTestId("game-option-sirli-quti").click();
    await modal.getByTestId("game-continue").click();
    await modal.getByTestId("teams-2").click();
    await modal.getByTestId("questions-8").click();
    await expect(modal.getByTestId("game-summary")).toHaveText(
      "2 jamoa · 8 ta savol · har biriga 30 soniya · taxminan 6 daqiqa",
    );
    await modal.getByTestId("game-start").click();

    await expect(page).toHaveURL(new RegExp(`/uz/games/${SLUG}/sirli-quti$`));
    await expect(
      page.getByRole("heading", { level: 1, name: "1 + 1 nechaga teng?" }),
    ).toBeVisible();
    await expect(page.getByTestId("game-turn")).toHaveText("Navbat: Ko'k jamoa");

    // Klaviatura bilan javob: "2" → B (to'g'ri).
    await page.keyboard.press("2");
    await expect(page.getByTestId("game-outcome")).toHaveText("To'g'ri!");
    // 10 + tezlik bonusi (javob 30 soniyaning boshida) — 14 yoki 15.
    await expect(page.getByTestId("team-score").first()).toContainText(/1[45]/);
    await page.getByTestId("game-next").click();
    await expect(page.getByTestId("game-turn")).toHaveText("Navbat: Qizil jamoa");

    // Sahifa yangilansa holat sessionStorage'dan tiklanadi.
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "2 + 2 nechaga teng?" }),
    ).toBeVisible();

    // Bitta bepul o'yin sarflandi (mehmon hisobi).
    await page.goto("/uz/games");
    await expect(page.getByTestId("allowance-free")).toHaveText("Bepul 10 tadan 9 ta qoldi");
  });
});
