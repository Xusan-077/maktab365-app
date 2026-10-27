// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { MotionProvider } from "@/components/ui/motion";
import uz from "@/lib/i18n/messages/uz.json";
import { ApiError } from "@/lib/api/types";
import type * as GamesApiModule from "@/lib/games/api";
import type { GameTopic } from "@/lib/games/api";
import { GUEST_ALLOWANCE_STORAGE_KEY, monthKey } from "@/lib/games/guest-allowance";
import { useGameStore } from "@/stores/game.store";

const api = vi.hoisted(() => ({
  questions: vi.fn(),
  startSession: vi.fn(),
  allowance: vi.fn(),
}));
const auth = vi.hoisted(() => ({ status: "unauthenticated" as string }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/games/api", async (importOriginal) => ({
  ...(await importOriginal<typeof GamesApiModule>()),
  getGamesApi: () => api,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: auth.status, signedIn: auth.status === "authenticated" }),
}));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));

import { GameStartModal } from "./GameStartModal";

const t = uz.games.modal;
const topic = (questionCount = 30): GameTopic => ({
  id: "3f2a9c1d-0b4e-4c1a-9b7e-000000000001",
  slug: "kasrlar-3f2a9c1d0b4e",
  title: "Kasrlar",
  subject: { slug: "matematika", title: { uz: "Matematika" } },
  grade: 5,
  textbook: { id: "b1", slug: "5-matematika", title: { uz: "Matematika 5" } },
  question_count: questionCount,
});
const question = {
  id: "q1",
  text: { uz: "?" },
  image: null,
  difficulty: "easy",
  options: [],
  answer_token: "x",
};

function setup(value: GameTopic = topic()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <MotionProvider>
          <GameStartModal topic={value} onClose={vi.fn()} />
        </MotionProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

async function pickAndContinue(game: string) {
  fireEvent.click(await screen.findByTestId(`game-option-${game}`));
  fireEvent.click(screen.getByTestId("game-continue"));
  return screen.findByTestId("game-setup");
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.status = "unauthenticated";
  localStorage.clear();
  sessionStorage.clear();
  useGameStore.getState().reset();
  api.questions.mockResolvedValue({ topic: topic(), questions: [question] });
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("GameStartModal", () => {
  it("requires a game before continuing and shows the step indicator", async () => {
    setup();
    expect(await screen.findByText(t.pickTitle)).toBeTruthy();
    expect(screen.getByTestId("game-modal-step").textContent).toBe("1-qadam / 2");
    expect((screen.getByTestId("game-continue") as HTMLButtonElement).disabled).toBe(true);
    const form = await pickAndContinue("sirli-quti");
    expect(screen.getByTestId("game-modal-step").textContent).toBe("2-qadam / 2");
    expect(within(form).getByTestId("game-summary").textContent).toBe(
      "2 jamoa · 16 ta savol · har biriga 30 soniya · taxminan 11 daqiqa",
    );
  });

  it("allows only 2 teams in tug of war", async () => {
    setup();
    const form = await pickAndContinue("arqon-tortish");
    expect((within(form).getByTestId("teams-1") as HTMLButtonElement).disabled).toBe(true);
    expect((within(form).getByTestId("teams-3") as HTMLButtonElement).disabled).toBe(true);
    expect(within(form).getByTestId("teams-2").getAttribute("aria-pressed")).toBe("true");
    expect(within(form).getByText(t.ropeOnlyTwo)).toBeTruthy();
  });

  it("disables question counts above the topic's questions", async () => {
    setup(topic(13));
    const form = await pickAndContinue("omad-charhi");
    expect((within(form).getByTestId("questions-16") as HTMLButtonElement).disabled).toBe(true);
    expect((within(form).getByTestId("questions-24") as HTMLButtonElement).disabled).toBe(true);
    expect(within(form).getByTestId("questions-12").getAttribute("aria-pressed")).toBe("true");
  });

  it("starts a guest game: uses one free game, stores setup and navigates", async () => {
    setup();
    const form = await pickAndContinue("sirli-quti");
    fireEvent.click(within(form).getByTestId("teams-3"));
    fireEvent.change(within(form).getByTestId("team-name-0"), {
      target: { value: "  Lochinlar " },
    });
    fireEvent.click(within(form).getByTestId("questions-8"));
    fireEvent.click(within(form).getByTestId("game-start"));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/games/kasrlar-3f2a9c1d0b4e/sirli-quti"),
    );
    expect(api.questions).toHaveBeenCalledWith("kasrlar-3f2a9c1d0b4e", 8);
    expect(api.startSession).not.toHaveBeenCalled();
    const state = useGameStore.getState();
    expect(state.game).toBe("sirli-quti");
    expect(state.scores.map((team) => team.name)).toEqual([
      "Lochinlar",
      "Qizil jamoa",
      "Yashil jamoa",
    ]);
    expect(state.session).toBeNull();
    expect(JSON.parse(localStorage.getItem(GUEST_ALLOWANCE_STORAGE_KEY)!)).toMatchObject({
      used: 1,
    });
  });

  it("shows the limit state instead of starting when guest games are used up", async () => {
    localStorage.setItem(
      GUEST_ALLOWANCE_STORAGE_KEY,
      JSON.stringify({ month: monthKey(new Date()), used: 10 }),
    );
    setup();
    const form = await pickAndContinue("sirli-quti");
    fireEvent.click(within(form).getByTestId("game-start"));
    expect(await screen.findByTestId("game-limit")).toBeTruthy();
    expect(screen.getByText(t.limitTitle)).toBeTruthy();
    expect(api.questions).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows the limit state on server game_limit_reached", async () => {
    auth.status = "authenticated";
    api.allowance.mockResolvedValue({
      month: "2026-10-01",
      free_games_limit: 10,
      free_games_used: 10,
      free_games_left: 0,
      coins: 3,
      game_cost_coins: 5,
    });
    api.startSession.mockRejectedValue(
      new ApiError("No free games", 403, { code: "game_limit_reached" }),
    );
    setup();
    const form = await pickAndContinue("omad-charhi");
    fireEvent.click(within(form).getByTestId("game-start"));
    const notice = await screen.findByTestId("game-limit");
    expect(within(notice).getByText(/Balansingiz: 3 tanga/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
