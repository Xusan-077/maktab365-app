"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TELEGRAM_BOT_ID, TELEGRAM_BOT_USERNAME } from "@/lib/auth/config";
import {
  TELEGRAM_WIDGET_SRC,
  TelegramLoginButton,
  type TelegramUser,
} from "@/components/auth/TelegramLoginButton";
import { AuthButton } from "./AuthButton";
import { TelegramIcon } from "./TelegramIcon";

interface TelegramLoginApi {
  auth: (
    options: { bot_id: number; request_access?: string; lang?: string },
    callback: (user: TelegramUser | false) => void,
  ) => void;
}
type TelegramWindow = Window & { Telegram?: { Login?: TelegramLoginApi } };

const SCRIPT_ATTR = "data-telegram-sdk";

/**
 * "Telegram bilan davom etish". `NEXT_PUBLIC_TELEGRAM_BOT_ID` bo'lsa — o'zimizning tugma
 * (`Telegram.Login.auth` oynasi); bo'lmasa va bot username bor bo'lsa — rasmiy vidjet; ikkalasi ham
 * bo'sh bo'lsa hech narsa chizilmaydi. Imzoni (hash) backend bot tokeni bilan tekshiradi.
 */
export function TelegramSignIn({
  onAuth,
  onUnavailable,
}: {
  onAuth: (user: TelegramUser) => void;
  /** Telegram skripti yuklanmagan (tarmoq/bloklovchi) bo'lsa. */
  onUnavailable: () => void;
}) {
  const t = useTranslations("login");
  const locale = useLocale();

  useEffect(() => {
    if (!TELEGRAM_BOT_ID || document.querySelector(`script[${SCRIPT_ATTR}]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = TELEGRAM_WIDGET_SRC;
    script.setAttribute(SCRIPT_ATTR, "");
    document.head.appendChild(script);
  }, []);

  if (!TELEGRAM_BOT_ID) {
    return (
      <TelegramLoginButton
        botUsername={TELEGRAM_BOT_USERNAME}
        onAuth={onAuth}
        label={t("methods")}
      />
    );
  }

  const open = () => {
    const login = (window as TelegramWindow).Telegram?.Login;
    if (!login) {
      onUnavailable();
      return;
    }
    login.auth(
      {
        bot_id: Number(TELEGRAM_BOT_ID),
        request_access: "write",
        lang: locale === "ru" || locale === "en" ? locale : "en",
      },
      (user) => {
        if (user) onAuth(user);
      },
    );
  };

  return (
    <AuthButton variant="telegram" onClick={open} data-testid="telegram-login" className="w-full">
      <TelegramIcon inverted className="size-6 lg:hidden" />
      <TelegramIcon className="hidden size-6 lg:block" />
      {t("telegram")}
    </AuthButton>
  );
}
