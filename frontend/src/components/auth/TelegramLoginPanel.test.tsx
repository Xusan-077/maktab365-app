// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";

const { signIn, requestTelegramLogin, fetchTelegramLoginStatus, openTelegramLink } = vi.hoisted(
  () => ({
    signIn: vi.fn(),
    requestTelegramLogin: vi.fn(),
    fetchTelegramLoginStatus: vi.fn(),
    openTelegramLink: vi.fn(),
  }),
);

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("@/lib/auth/telegram-login", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestTelegramLogin,
  fetchTelegramLoginStatus,
  openTelegramLink,
}));

import { TelegramLoginPanel } from "./TelegramLoginPanel";

const TOKEN = "t".repeat(43);
const BOT_URL = `https://t.me/darslik365_bot?start=${TOKEN}`;

function mockMedia(touch: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("coarse") ? touch : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function setup() {
  const onSignedIn = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="uz" messages={uz}>
        <TelegramLoginPanel onSignedIn={onSignedIn} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { onSignedIn, user };
}

async function startLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Telegram bilan kirish" }));
  await screen.findByText("Telegramda Start bosing");
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockMedia(false);
  focusManager.setFocused(true);
  signIn.mockReset().mockResolvedValue({ ok: true, error: undefined });
  requestTelegramLogin
    .mockReset()
    .mockResolvedValue({ token: TOKEN, bot_url: BOT_URL, expires_in: 300 });
  fetchTelegramLoginStatus.mockReset().mockResolvedValue("pending");
  openTelegramLink.mockReset();
});

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe("TelegramLoginPanel", () => {
  it("desktop: QR, 'Telegramda ochish' havolasi va 5:00 teskari sanoq", async () => {
    const { user } = setup();
    await startLogin(user);
    expect(screen.getByTestId("telegram-qr")).toBeTruthy();
    const open = screen.getByRole("link", { name: "Telegramda ochish" });
    expect(open.getAttribute("href")).toBe(BOT_URL);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(screen.getByText("Havola 5:00 amal qiladi")).toBeTruthy();
    expect(openTelegramLink).not.toHaveBeenCalled();

    await advance(1000);
    expect(screen.getByText("Havola 4:59 amal qiladi")).toBeTruthy();
  });

  it("mobil: Telegram darhol ochiladi, QR ko'rsatilmaydi", async () => {
    mockMedia(true);
    const { user } = setup();
    await startLogin(user);
    expect(openTelegramLink).toHaveBeenCalledWith(BOT_URL);
    expect(screen.queryByTestId("telegram-qr")).toBeNull();
    expect(screen.getByRole("link", { name: "Telegramda ochish" })).toBeTruthy();
  });

  it("2 s da polling qiladi, confirmed bo'lgach signIn va polling to'xtaydi", async () => {
    const { user, onSignedIn } = setup();
    await startLogin(user);
    await waitFor(() => expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(1));
    expect(fetchTelegramLoginStatus).toHaveBeenCalledWith(TOKEN);

    await advance(2000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(2);

    fetchTelegramLoginStatus.mockResolvedValue("confirmed");
    await advance(2000);
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith("telegram-bot", {
      redirect: false,
      token: TOKEN,
      locale: "uz",
    });
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("backend expired desa: 'Qayta urinish', polling to'xtaydi, qayta urinish yangi havola oladi", async () => {
    const { user } = setup();
    fetchTelegramLoginStatus.mockResolvedValue("expired");
    await startLogin(user).catch(() => {});
    expect(await screen.findByText("Havola muddati tugadi.")).toBeTruthy();
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);

    fetchTelegramLoginStatus.mockResolvedValue("pending");
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await screen.findByText("Telegramda Start bosing");
    expect(requestTelegramLogin).toHaveBeenCalledTimes(2);
  });

  it("5 daqiqa o'tsa mahalliy ravishda expired bo'ladi va polling to'xtaydi", async () => {
    const { user } = setup();
    await startLogin(user);
    await advance(300_000);
    expect(await screen.findByText("Havola muddati tugadi.")).toBeTruthy();
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);
  });

  it("tab yashirin bo'lsa polling to'xtaydi, qaytganda davom etadi", async () => {
    const { user } = setup();
    await startLogin(user);
    await waitFor(() => expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(1));

    act(() => focusManager.setFocused(false));
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(1);

    act(() => focusManager.setFocused(true));
    await advance(2000);
    expect(fetchTelegramLoginStatus.mock.calls.length).toBeGreaterThan(1);
  });

  it("havola olinmasa xato va 'Qayta urinish'", async () => {
    requestTelegramLogin.mockRejectedValue(new ApiError("down", 0, { code: "network_error" }));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Telegram bilan kirish" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      uz.authForm.errors.network_error,
    );
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeTruthy();
  });

  it("nonce mos kelmasa (403) xato ko'rsatiladi, qayta so'ralmaydi", async () => {
    fetchTelegramLoginStatus.mockRejectedValue(
      new ApiError("other browser", 403, { code: "telegram_nonce_mismatch" }),
    );
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Telegram bilan kirish" }));
    expect(await screen.findByText(uz.authForm.errors.telegram_nonce_mismatch)).toBeTruthy();
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);
  });

  it("signIn xatosi (token ishlatilgan) — xato matni, onSignedIn chaqirilmaydi", async () => {
    fetchTelegramLoginStatus.mockResolvedValue("confirmed");
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "telegram_login_expired" });
    const { user, onSignedIn } = setup();
    await user.click(screen.getByRole("button", { name: "Telegram bilan kirish" }));
    expect(await screen.findByText(uz.authForm.errors.telegram_login_expired)).toBeTruthy();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
