"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { TelegramLoginPanel } from "@/components/auth/TelegramLoginPanel";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { GOOGLE_PROVIDER } from "@/lib/auth/config";
import { ROUTES } from "@/lib/utils/routes";
import { AuthButton } from "./AuthButton";

/**
 * "Google / Telegram bilan davom etish". Telegram — bot orqali (`TelegramLoginPanel`: QR/deep-link,
 * o'z holatlari va xatolari bilan). Google xatolari (`authError` ham) tugmalar ostida inline chiqadi
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

  const google = () => {
    setError(undefined);
    setGooglePending(true);
    void signIn(GOOGLE_PROVIDER, {
      redirectTo: callbackUrl ?? `/${locale}${ROUTES.onboarding}`,
    });
  };

  return (
    <div className={className} data-testid="social-signin">
      <div className="flex flex-col gap-3">
        <AuthButton variant="white" loading={googlePending} onClick={google} className="w-full">
          {!googlePending && <GoogleIcon className="size-5" />}
          {t("google")}
        </AuthButton>
        <TelegramLoginPanel onSignedIn={() => completeSignIn(callbackUrl)} />
      </div>
      <p role="alert" aria-live="polite" className="text-danger mt-2 text-[13px] empty:hidden">
        {error ? errorText(error) : null}
      </p>
    </div>
  );
}
