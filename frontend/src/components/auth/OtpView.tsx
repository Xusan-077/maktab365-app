"use client";

import { useId, useState } from "react";
import { ArrowLeft, Info, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/layout/Logo";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { AuthButton } from "@/components/login/AuthButton";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { useResendTimer } from "@/hooks/useResendTimer";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { OTP_PROVIDER } from "@/lib/auth/config";
import { OTP_LENGTH, OTP_RESEND_SECONDS } from "@/lib/auth/otp";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { OtpCodeInput } from "./OtpCodeInput";

type ApiLocale = Parameters<typeof authClient.requestOtp>[1];

/** 0:42 ko'rinishi. */
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Kirish sahifasiga qaytish havolasi (email oldindan to'ldiriladi, callbackUrl saqlanadi). */
function loginHref(email?: string, callbackUrl?: string) {
  const query = new URLSearchParams({
    ...(email && { email }),
    ...(callbackUrl && { callbackUrl }),
  });
  const text = query.toString();
  return text ? `${ROUTES.login}?${text}` : ROUTES.login;
}

/**
 * Emailga kelgan 6 xonali kod bilan kirish (`/kod?email=…`): 6-raqam kiritilishi bilan avtomatik
 * yuboriladi, "Kirish" tugmasi esa kod to'lguncha o'chiq. Xatolar kataklar ostida (`aria-live`).
 */
export function OtpView({ email, callbackUrl }: { email?: string; callbackUrl?: string }) {
  const t = useTranslations("login.verify");
  const locale = useLocale();
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const { left, restart } = useResendTimer(OTP_RESEND_SECONDS);
  const messageId = useId();
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  const submit = async (value: string) => {
    if (!email || pending || value.length !== OTP_LENGTH) return;
    setError(undefined);
    setInfo(undefined);
    setPending(true);
    const result = await signIn(OTP_PROVIDER, {
      redirect: false,
      email,
      code: value,
      locale,
    }).catch(() => ({ error: "network", code: "network_error" }));
    if (result?.error) {
      setError(result.code ?? "unknown");
      setPending(false);
      setCode("");
      setAttempt((n) => n + 1); // kataklar tozalanadi, fokus birinchisiga
      return;
    }
    await completeSignIn(callbackUrl);
  };

  const resend = async () => {
    if (!email) return;
    setError(undefined);
    setResending(true);
    try {
      await authClient.requestOtp(email, locale as ApiLocale);
      setInfo(t("sent"));
      setCode("");
      setAttempt((n) => n + 1);
    } catch (failure) {
      setError(errorCodeOf(failure));
    } finally {
      restart();
      setResending(false);
    }
  };

  const message = error ? errorText(error) : info;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-5 pt-3 pb-6">
      <div className="relative flex h-11 items-center justify-center">
        <Link
          href={loginHref(email, callbackUrl)}
          aria-label={t("back")}
          className="text-auth-text hover:bg-auth-surface-2 focus-visible:ring-brand-ring absolute left-0 inline-flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-4"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Logo height={22} />
      </div>

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex flex-1 flex-col gap-6 pt-8 focus:outline-none"
      >
        {!email ? (
          <>
            <h1 className="text-[28px] leading-tight font-extrabold">{t("title")}</h1>
            <p role="alert" className="text-danger text-[15px]">
              {t("missingEmail")}
            </p>
            <Link
              href={ROUTES.login}
              className="text-brand-text inline-flex min-h-11 items-center font-semibold hover:underline"
            >
              {t("back")}
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <span className="bg-brand-soft text-brand-text flex size-14 items-center justify-center rounded-2xl">
                <Mail className="size-7" aria-hidden />
              </span>
              <h1 className="text-[28px] leading-tight font-extrabold">{t("title")}</h1>
              <p className="text-auth-muted text-[15px]">
                {t("text", { email })}{" "}
                <Link
                  href={loginHref(email, callbackUrl)}
                  className="text-brand-text font-semibold hover:underline"
                >
                  {t("change")}
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <OtpCodeInput
                key={attempt}
                label={t("legend")}
                onComplete={(value) => void submit(value)}
                onCodeChange={setCode}
                describedBy={message ? messageId : undefined}
                disabled={pending}
                invalid={Boolean(error)}
              />
              <p
                id={messageId}
                role={error ? "alert" : "status"}
                aria-live="polite"
                className={
                  error
                    ? "text-danger text-[13px] empty:hidden"
                    : "text-auth-muted text-[13px] empty:hidden"
                }
              >
                {message}
              </p>
              <p className="text-auth-muted text-[14px]">
                {t("noCode")}{" "}
                {left > 0 ? (
                  <span className="text-auth-subtle" data-testid="resend-timer">
                    {t("resendIn", { time: clock(left) })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void resend()}
                    disabled={resending || pending}
                    className="text-brand-text focus-visible:ring-brand-ring rounded font-semibold outline-none hover:underline focus-visible:ring-4 disabled:opacity-60"
                  >
                    {t("resend")}
                  </button>
                )}
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-4">
              <div className="bg-auth-surface-2 text-auth-muted flex items-start gap-3 rounded-[14px] p-4 text-[13px]">
                <Info className="text-brand-text mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{t("info")}</p>
              </div>
              <AuthButton
                type="button"
                loading={pending}
                disabled={code.length !== OTP_LENGTH}
                onClick={() => void submit(code)}
                className="w-full"
              >
                {t("submit")}
              </AuthButton>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
