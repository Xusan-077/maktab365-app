// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";

const { signIn, requestTelegramLogin, fetchTelegramLoginStatus } = vi.hoisted(() => ({
  signIn: vi.fn(),
  requestTelegramLogin: vi.fn(),
  fetchTelegramLoginStatus: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("@/lib/auth/telegram-login", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestTelegramLogin,
  fetchTelegramLoginStatus,
}));

import { TelegramLoginPanel } from "./TelegramLoginPanel";

const TOKEN = "t".repeat(43);
const BOT_URL = `https://t.me/darslik365_bot?start=${TOKEN}`;

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

/** Panel ochilishi bilan havola olinadi: Telegram tugmasi havolaga aylanguncha kutiladi. */
const botLink = () => screen.findByRole("link", { name: "Telegram bilan kirish" });

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  focusManager.setFocused(true);
  signIn.mockReset().mockResolvedValue({ ok: true, error: undefined });
  requestTelegramLogin
    .mockReset()
    .mockResolvedValue({ token: TOKEN, bot_url: BOT_URL, expires_in: 300 });
  fetchTelegramLoginStatus.mockReset().mockResolvedValue("pending");
});

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe("TelegramLoginPanel", () => {
  it("ochilishi bilan havola oladi: QR doim ko'rinadi, tugma botni yangi oynada ochadi, 5:00 sanoq", async () => {
    setup();
    expect(screen.getByTestId("telegram-qr")).toBeTruthy();
    const link = await botLink();
    expect(requestTelegramLogin).toHaveBeenCalledTimes(1);
    expect(link.getAttribute("href")).toBe(BOT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByTitle(uz.telegramLogin.qrTitle)).toBeTruthy();
    expect(screen.getByText("Kod 5:00 amal qiladi")).toBeTruthy();

    await advance(1000);
    expect(screen.getByText("Kod 4:59 amal qiladi")).toBeTruthy();
  });

  it("2 s da polling qiladi, confirmed bo'lgach shu sahifada signIn va polling to'xtaydi", async () => {
    const { onSignedIn } = setup();
    await botLink();
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

  it("backend expired desa: QR ustida 'Qayta urinish', polling to'xtaydi, yangi havola olinadi", async () => {
    fetchTelegramLoginStatus.mockResolvedValue("expired");
    const { user } = setup();
    expect(await screen.findByText(uz.telegramLogin.expired)).toBeTruthy();
    expect(screen.getByTestId("telegram-qr")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Telegram bilan kirish" })).toBeNull();
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);

    fetchTelegramLoginStatus.mockResolvedValue("pending");
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    await botLink();
    expect(requestTelegramLogin).toHaveBeenCalledTimes(2);
  });

  it("5 daqiqa o'tsa mahalliy ravishda expired bo'ladi va polling to'xtaydi", async () => {
    setup();
    await botLink();
    await advance(300_000);
    expect(await screen.findByText(uz.telegramLogin.expired)).toBeTruthy();
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);
  });

  it("tab yashirin bo'lsa polling to'xtaydi, qaytganda davom etadi", async () => {
    setup();
    await botLink();
    await waitFor(() => expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(1));

    act(() => focusManager.setFocused(false));
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(1);

    act(() => focusManager.setFocused(true));
    await advance(2000);
    expect(fetchTelegramLoginStatus.mock.calls.length).toBeGreaterThan(1);
  });

  it("havola olinmasa xato va 'Qayta urinish' (Telegram tugmasi ham qayta urinadi)", async () => {
    requestTelegramLogin.mockRejectedValue(new ApiError("down", 0, { code: "network_error" }));
    const { user } = setup();
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      uz.authForm.errors.network_error,
    );
    requestTelegramLogin.mockResolvedValue({ token: TOKEN, bot_url: BOT_URL, expires_in: 300 });
    await user.click(screen.getByRole("button", { name: "Telegram bilan kirish" }));
    await botLink();
    expect(requestTelegramLogin).toHaveBeenCalledTimes(2);
  });

  it("nonce mos kelmasa (403) xato ko'rsatiladi, qayta so'ralmaydi", async () => {
    fetchTelegramLoginStatus.mockRejectedValue(
      new ApiError("other browser", 403, { code: "telegram_nonce_mismatch" }),
    );
    setup();
    expect(await screen.findByText(uz.authForm.errors.telegram_nonce_mismatch)).toBeTruthy();
    const calls = fetchTelegramLoginStatus.mock.calls.length;
    await advance(10_000);
    expect(fetchTelegramLoginStatus).toHaveBeenCalledTimes(calls);
  });

  it("signIn xatosi (token ishlatilgan) — xato matni, onSignedIn chaqirilmaydi", async () => {
    fetchTelegramLoginStatus.mockResolvedValue("confirmed");
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "telegram_login_expired" });
    const { onSignedIn } = setup();
    expect(await screen.findByText(uz.authForm.errors.telegram_login_expired)).toBeTruthy();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
