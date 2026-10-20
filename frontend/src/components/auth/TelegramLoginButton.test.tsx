// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import {
  TELEGRAM_CALLBACK,
  TELEGRAM_WIDGET_SRC,
  TelegramLoginButton,
  type TelegramUser,
} from "./TelegramLoginButton";
import { telegramCredentials } from "@/lib/auth/telegram-credentials";

const USER: TelegramUser = {
  id: 777,
  first_name: "Vali",
  username: "vali_k",
  auth_date: 1_760_000_000,
  hash: "a".repeat(64),
};

function setup(botUsername = "maktab365_bot", locale = "ru") {
  const onAuth = vi.fn();
  const view = render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <TelegramLoginButton botUsername={botUsername} onAuth={onAuth} label="Telegram" />
    </NextIntlClientProvider>,
  );
  return { onAuth, view };
}

const callback = () =>
  (window as unknown as Record<string, (user: TelegramUser) => void>)[TELEGRAM_CALLBACK];

afterEach(cleanup);

describe("TelegramLoginButton", () => {
  it("rasmiy widget skriptini bot va callback bilan qo'shadi", () => {
    setup();
    const script = screen.getByTestId("telegram-login").querySelector("script");
    expect(script?.getAttribute("src")).toBe(TELEGRAM_WIDGET_SRC);
    expect(script?.getAttribute("data-telegram-login")).toBe("maktab365_bot");
    expect(script?.getAttribute("data-onauth")).toBe(`${TELEGRAM_CALLBACK}(user)`);
    expect(script?.getAttribute("data-lang")).toBe("ru");
  });

  it("widget callback'i onAuth'ni foydalanuvchi bilan chaqiradi", () => {
    const { onAuth } = setup();
    callback()(USER);
    expect(onAuth).toHaveBeenCalledExactlyOnceWith(USER);
  });

  it("uz tilida data-lang qo'yilmaydi (widget qo'llamaydi)", () => {
    setup("maktab365_bot", "uz");
    const script = screen.getByTestId("telegram-login").querySelector("script");
    expect(script?.hasAttribute("data-lang")).toBe(false);
  });

  it("bot nomi bo'lmasa hech narsa chizilmaydi", () => {
    setup("");
    expect(screen.queryByTestId("telegram-login")).toBeNull();
  });

  it("o'chirilganda global callback tozalanadi", () => {
    const { view } = setup();
    view.unmount();
    expect(callback()).toBeUndefined();
  });
});

describe("telegramCredentials", () => {
  it("hamma qiymatni satrga o'giradi, bo'sh maydonlarni tashlaydi, locale qo'shadi", () => {
    expect(telegramCredentials({ ...USER, last_name: "" }, "uz")).toEqual({
      id: "777",
      first_name: "Vali",
      username: "vali_k",
      auth_date: "1760000000",
      hash: "a".repeat(64),
      locale: "uz",
    });
  });
});
