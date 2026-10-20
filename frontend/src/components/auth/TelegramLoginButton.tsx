"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";

/** Telegram Login Widget `data-onauth` ga beradigan foydalanuvchi (imzo `hash` backend'da tekshiriladi). */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";
/** `data-onauth` skripti shu nomli global funksiyani chaqiradi. */
export const TELEGRAM_CALLBACK = "maktab365TelegramAuth";

type TelegramWindow = Window & Record<string, unknown>;

const WIDGET_LANGUAGES = new Set(["ru", "en"]);

/**
 * Rasmiy Telegram Login Widget (iframe tugma). Bot `@BotFather` da `/setdomain` bilan sayt
 * domeniga bog'langan bo'lishi kerak. `botUsername` bo'sh bo'lsa hech narsa chizilmaydi.
 */
export function TelegramLoginButton({
  botUsername,
  onAuth,
  label,
}: {
  botUsername: string;
  onAuth: (user: TelegramUser) => void;
  /** Guruh nomi (ekran o'qigich uchun). */
  label: string;
}) {
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const handler = useRef(onAuth);
  useEffect(() => {
    handler.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    const container = host.current;
    if (!container || !botUsername) return;
    const target = window as unknown as TelegramWindow;
    target[TELEGRAM_CALLBACK] = (user: TelegramUser) => handler.current(user);

    const script = document.createElement("script");
    script.async = true;
    script.src = TELEGRAM_WIDGET_SRC;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    if (WIDGET_LANGUAGES.has(locale)) script.setAttribute("data-lang", locale);
    script.setAttribute("data-onauth", `${TELEGRAM_CALLBACK}(user)`);
    container.appendChild(script);

    return () => {
      delete target[TELEGRAM_CALLBACK];
      container.replaceChildren();
    };
  }, [botUsername, locale]);

  if (!botUsername) return null;
  return (
    <div
      ref={host}
      role="group"
      aria-label={label}
      data-testid="telegram-login"
      className="flex min-h-10 justify-center"
    />
  );
}
