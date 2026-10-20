"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { useResendTimer } from "@/hooks/useResendTimer";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { OTP_PROVIDER } from "@/lib/auth/config";
import { OTP_RESEND_SECONDS } from "@/lib/auth/otp";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { AuthCard } from "./AuthCard";
import { FormAlert } from "./FormAlert";
import { OtpCodeInput } from "./OtpCodeInput";

type ApiLocale = Parameters<typeof authClient.requestOtp>[1];

/** Emailga kelgan 6 xonali kod bilan kirish (`/kod?email=…`): kod to'lishi bilan avtomatik yuboriladi. */
export function OtpView({ email, callbackUrl }: { email?: string; callbackUrl?: string }) {
  const t = useTranslations("authForm.otp");
  const locale = useLocale();
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const { left, restart } = useResendTimer(OTP_RESEND_SECONDS);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  const changeEmail = (
    <Link href={ROUTES.login} className={buttonVariants({ variant: "ghost", size: "lg" })}>
      {t("changeEmail")}
    </Link>
  );

  if (!email) {
    return (
      <AuthCard title={t("title")}>
        <FormAlert>{t("missingEmail")}</FormAlert>
        {changeEmail}
      </AuthCard>
    );
  }

  const submit = async (code: string) => {
    setError(undefined);
    setInfo(undefined);
    setPending(true);
    const result = await signIn(OTP_PROVIDER, { redirect: false, email, code, locale }).catch(
      () => ({ error: "network", code: "network_error" }),
    );
    if (result?.error) {
      setError(result.code ?? "unknown");
      setPending(false);
      setAttempt((value) => value + 1); // kataklar tozalanadi, fokus birinchisiga
      return;
    }
    await completeSignIn(callbackUrl);
  };

  const resend = async () => {
    setError(undefined);
    setResending(true);
    try {
      await authClient.requestOtp(email, locale as ApiLocale);
      setInfo(t("sent"));
      setAttempt((value) => value + 1);
    } catch (failure) {
      setError(errorCodeOf(failure));
    } finally {
      restart();
      setResending(false);
    }
  };

  return (
    <AuthCard title={t("title")} text={t("text", { email })}>
      {error && <FormAlert>{errorText(error)}</FormAlert>}
      {info && <FormAlert variant="success">{info}</FormAlert>}
      <OtpCodeInput
        key={attempt}
        label={t("codeLabel")}
        onComplete={(code) => void submit(code)}
        disabled={pending}
        invalid={Boolean(error)}
      />
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          loading={resending}
          disabled={left > 0 || pending}
          onClick={() => void resend()}
        >
          {left > 0 ? t("resendIn", { seconds: left }) : t("resend")}
        </Button>
        {changeEmail}
      </div>
    </AuthCard>
  );
}
