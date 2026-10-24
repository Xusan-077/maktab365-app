"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import type { TelegramUser } from "@/components/auth/TelegramLoginButton";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { GOOGLE_PROVIDER, TELEGRAM_PROVIDER } from "@/lib/auth/config";
import { telegramCredentials } from "@/lib/auth/telegram-credentials";
import { ROUTES } from "@/lib/utils/routes";
import { AuthButton } from "./AuthButton";
import { TelegramSignIn } from "./TelegramSignIn";

/**
 * "Google / Telegram bilan davom etish". Xatolar (`authError` ham) tugmalar ostida inline chiqadi
 * (`aria-live`), toast emas.
 */
export function SocialButtons({
  callbackUrl,
  initialError,
  className,
}: {
  callbackUrl?: string;
  initialError?: string;
  className?: string;
}) {
  const t = useTranslations("login");
  const locale = useLocale();
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const [error, setError] = useState<string | undefined>(initialError);
  const [googlePending, setGooglePending] = useState(false);
  const [telegramPending, setTelegramPending] = useState(false);

  const google = () => {
    setError(undefined);
    setGooglePending(true);
    void signIn(GOOGLE_PROVIDER, {
      redirectTo: callbackUrl ?? `/${locale}${ROUTES.onboarding}`,
    });
  };

  const telegram = async (user: TelegramUser) => {
    setError(undefined);
    setTelegramPending(true);
    const result = await signIn(TELEGRAM_PROVIDER, {
      redirect: false,
      ...telegramCredentials(user, locale),
    }).catch(() => ({ error: "network", code: "network_error" }));
    if (result?.error) {
      setError(result.code ?? "unknown");
      setTelegramPending(false);
      return;
    }
    await completeSignIn(callbackUrl);
  };

  return (
    <div className={className} data-testid="social-signin">
      <div className="flex flex-col gap-3">
        <AuthButton variant="white" loading={googlePending} onClick={google} className="w-full">
          {!googlePending && <GoogleIcon className="size-5" />}
          {t("google")}
        </AuthButton>
        <div
          aria-busy={telegramPending || undefined}
          className={telegramPending ? "opacity-70" : undefined}
        >
          <TelegramSignIn
            onAuth={(user) => void telegram(user)}
            onUnavailable={() => setError("network_error")}
          />
        </div>
      </div>
      <p role="alert" aria-live="polite" className="text-danger mt-2 text-[13px] empty:hidden">
        {error ? errorText(error) : null}
      </p>
    </div>
  );
}
