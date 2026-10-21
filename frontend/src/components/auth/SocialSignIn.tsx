"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { GOOGLE_PROVIDER, TELEGRAM_BOT_USERNAME, TELEGRAM_PROVIDER } from "@/lib/auth/config";
import { telegramCredentials } from "@/lib/auth/telegram-credentials";
import { ROUTES } from "@/lib/utils/routes";
import { FormAlert } from "./FormAlert";
import { GoogleIcon } from "./GoogleIcon";
import { TelegramLoginButton, type TelegramUser } from "./TelegramLoginButton";

/**
 * "Google / Telegram bilan davom etish". Xatolar (`authError` ham) tugmalar ustida: tugmalar
 * o'rnidan siljimaydi, faqat xabar qatori qo'shiladi.
 */
export function SocialSignIn({
  callbackUrl,
  initialError,
}: {
  callbackUrl?: string;
  initialError?: string;
}) {
  const t = useTranslations("authForm");
  const locale = useLocale();
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const [error, setError] = useState<string | undefined>(initialError);
  const [googlePending, setGooglePending] = useState(false);

  const google = () => {
    setError(undefined);
    setGooglePending(true);
    void signIn(GOOGLE_PROVIDER, {
      redirectTo: callbackUrl ?? `/${locale}${ROUTES.onboarding}`,
    });
  };

  const telegram = async (user: TelegramUser) => {
    setError(undefined);
    const result = await signIn(TELEGRAM_PROVIDER, {
      redirect: false,
      ...telegramCredentials(user, locale),
    }).catch(() => ({ error: "network", code: "network_error" }));
    if (result?.error) {
      setError(result.code ?? "unknown");
      return;
    }
    await completeSignIn(callbackUrl);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="social-signin">
      {error && <FormAlert>{errorText(error)}</FormAlert>}
      <Button variant="secondary" size="lg" loading={googlePending} onClick={google}>
        {!googlePending && <GoogleIcon className="size-5" />}
        {t("google")}
      </Button>
      <TelegramLoginButton
        botUsername={TELEGRAM_BOT_USERNAME}
        onAuth={(user) => void telegram(user)}
        label={t("telegram")}
      />
    </div>
  );
}
