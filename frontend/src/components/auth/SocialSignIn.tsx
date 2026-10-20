"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { GOOGLE_PROVIDER, TELEGRAM_BOT_USERNAME, TELEGRAM_PROVIDER } from "@/lib/auth/config";
import { useRouter } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";
import { FormAlert } from "./FormAlert";
import { telegramCredentials } from "@/lib/auth/telegram-credentials";
import { TelegramLoginButton, type TelegramUser } from "./TelegramLoginButton";

type ApiLocale = Parameters<typeof authClient.requestOtp>[1];

/** Email'ga kod yuborish: kod yuboriladi va `/kod` sahifasiga o'tiladi. */
function OtpRequestForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("authForm");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(undefined);
    try {
      await authClient.requestOtp(email, locale as ApiLocale);
    } catch (error) {
      const code = errorCodeOf(error);
      // Kod yaqinda yuborilgan bo'lsa ham kiritish sahifasiga o'tamiz (taymer o'sha yerda).
      if (code !== "otp_cooldown") {
        setFormError(code);
        return;
      }
    }
    const query = new URLSearchParams({ email, ...(callbackUrl && { callbackUrl }) });
    router.push(`${ROUTES.otp}?${query}`);
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3" data-testid="otp-request">
      <h2 className="text-base font-semibold">{t("emailCode")}</h2>
      {formError && <FormAlert>{errorText(formError)}</FormAlert>}
      <Input
        label={t("email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t("emailPlaceholder")}
        error={errorText(errors.email?.message)}
        {...register("email")}
      />
      <Button type="submit" variant="secondary" size="lg" loading={isSubmitting}>
        {t("emailCodeSubmit")}
      </Button>
    </form>
  );
}

/** "Google / Telegram / Email kodi" bilan kirish. Xatolar (`authError` ham) forma ustida. */
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
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{errorText(error)}</FormAlert>}
      <Button variant="secondary" size="lg" loading={googlePending} onClick={google}>
        {t("google")}
      </Button>
      <TelegramLoginButton
        botUsername={TELEGRAM_BOT_USERNAME}
        onAuth={(user) => void telegram(user)}
        label={t("telegram")}
      />
      <OtpRequestForm callbackUrl={callbackUrl} />
    </div>
  );
}
