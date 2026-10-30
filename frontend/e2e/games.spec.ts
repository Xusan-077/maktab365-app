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
    await expect(page.getByTestId("box-board").getByRole("button")).toHaveCount(8);
  });

  test("Sirli quti: qutilar, savol modali, bonus/bomba va natija", async ({ page }) => {
    await mockGamesApi(page);
    await startGame(page, "sirli-quti");
    const board = page.getByTestId("box-board");
    await expect(board.getByRole("button")).toHaveCount(8);
    await expect(page.getByTestId("game-turn")).toHaveText("Navbat: Ko'k jamoa");

    for (let n = 1; n <= 8; n++) {
      const tile = page.getByTestId(`box-${n}`);
      await expect(tile).toBeEnabled();
      await tile.click();
      const dialog = page.getByTestId("box-question");
      await expect(dialog.or(page.locator(`[data-testid="box-${n}"][data-result]`))).toBeVisible();
      if (await dialog.isVisible()) {
        await expect(dialog.getByRole("heading", { level: 1 })).toContainText("nechaga teng?");
        // Klaviatura: "2" → B (mock'da har savolda to'g'ri).
        await page.keyboard.press("2");
        await expect(dialog.getByTestId("game-outcome")).toHaveText("To'g'ri!");
        await dialog.getByTestId("game-next").click();
        await expect(dialog).toHaveCount(0);
        await expect(tile).toHaveAttribute("data-result", "correct");
      } else {
        await expect(tile).toHaveAttribute("data-result", /^(bonus|bomb)$/);
      }
      if (n === 1) {
        // Navbat keyingi jamoaga o'tdi; sahifa yangilansa ochilgan qutilar tiklanadi.
        await expect(page.getByTestId("game-turn")).toHaveText("Navbat: Qizil jamoa");
        await page.reload();
        await expect(page.getByTestId("box-1")).toHaveAttribute("data-result", /.+/);
      }
    }

    await expect(page).toHaveURL(new RegExp(`/uz/games/${SLUG}/natija$`));
    await expect(page.getByTestId("game-ranking").getByRole("listitem")).toHaveCount(2);
    await expect(page.getByTestId("game-headline")).toBeVisible();
  });

  test("Omad charhi: aylantirish, sektor, bonus va navbat", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // 0.7 → "Bonus" sektori (5-sektor).
    await page.addInitScript(() => {
      Math.random = () => 0.7;
    });
    await mockGamesApi(page);
    await startGame(page, "omad-charhi");
    await expect(page.getByTestId("game-turn")).toHaveText("Navbat: Ko'k jamoa");

    await page.getByTestId("wheel-spin").click();
    await expect(page.getByTestId("wheel-bonus")).toContainText("Bonus! Ko'k jamoa +2 ball");
    await expect(page.getByTestId("team-score").first()).toContainText("2");
    await page.getByTestId("game-next").click();
    await expect(page.getByTestId("game-turn")).toHaveText("Navbat: Qizil jamoa");
    await expect(page.getByTestId("wheel-left")).toHaveText("8 ta savol qoldi");

    // Endi har aylanish "1" sektoriga (oddiy savol, 1 ball).
    await page.evaluate(() => {
      Math.random = () => 0.01;
    });
    for (let round = 0; round < 8; round++) {
      await page.getByTestId("wheel-spin").click();
      const panel = page.getByTestId("wheel-question");
      await expect(panel.getByTestId("wheel-sector")).toHaveText("Sektor 1");
      await expect(panel.getByTestId("wheel-points")).toHaveText("1 ball");
      await page.keyboard.press("b");
      await expect(panel.getByTestId("game-outcome")).toHaveText("To'g'ri!");
      await panel.getByTestId("game-next").click();
    }
    await expect(page).toHaveURL(new RegExp(`/uz/games/${SLUG}/natija$`));
    // Ko'k: bonus 2 + 4 savol = 6, Qizil: 4.
    await expect(page.getByTestId("game-headline")).toHaveText("Ko'k jamoa g'olib!");
  });

  test("Arqon tortish: ikki panel, blok va g'olib modali", async ({ page }) => {
    await mockGamesApi(page);
    await startGame(page, "arqon-tortish");
    const left = page.getByTestId("rope-panel-0");
    const right = page.getByTestId("rope-panel-1");
    const art = page.getByTestId("rope-art");
    await expect(page.getByTestId("rope-timer")).toHaveText(/^(03:00|02:5\d)$/);
    await expect(left.getByTestId("rope-question-0")).toHaveText("1 + 1 nechaga teng?");
    await expect(right.getByTestId("rope-question-1")).toHaveText("2 + 2 nechaga teng?");

    // O'ng jamoa xato (6 → A): panel bloklanadi, keyin yangi savol.
    await page.keyboard.press("6");
    await expect(right).toHaveAttribute("data-blocked", "true");
    await expect(right).not.toHaveAttribute("data-blocked");
    await expect(right.getByTestId("rope-question-1")).toHaveText("4 + 4 nechaga teng?");
    await expect(art).toHaveAttribute("data-position", "0");

    // Chap jamoa 5 marta to'g'ri (1–4 klavishlari, "2" → B) — arqon chapga, g'alaba.
    for (let pull = 1; pull <= 5; pull++) {
      await expect(left.getByTestId("answer-option").nth(1)).toBeEnabled();
      await page.keyboard.press("2");
      await expect(art).toHaveAttribute("data-position", String(-pull));
    }
    const winner = page.getByTestId("rope-winner");
    await expect(winner.getByTestId("game-headline")).toHaveText("Ko'k jamoa g'olib!");
    await winner.getByTestId("rope-see-result").click();
    await expect(page).toHaveURL(new RegExp(`/uz/games/${SLUG}/natija$`));
    await expect(page.getByTestId("game-headline")).toHaveText("Ko'k jamoa g'olib!");
  });
});

async function startGame(page: Page, game: "sirli-quti" | "omad-charhi" | "arqon-tortish") {
  await page.goto("/uz/games");
  await page.getByRole("button", { name: `«${topic.title}» mavzusida o'ynash` }).click();
  const modal = page.getByTestId("game-modal");
  await modal.getByTestId(`game-option-${game}`).click();
  await modal.getByTestId("game-continue").click();
  await modal.getByTestId("questions-8").click();
  await modal.getByTestId("game-start").click();
  await expect(page).toHaveURL(new RegExp(`/uz/games/${SLUG}/${game}$`));
}
