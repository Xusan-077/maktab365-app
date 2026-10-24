"use client";

import { useId, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";
import { AuthButton } from "./AuthButton";

type ApiLocale = Parameters<typeof authClient.requestOtp>[1];

/**
 * Email → 6 xonali kod. Hisob bo'lmasa kod bilan kirganda avtomatik yaratiladi. Xatolar inputning
 * ostida (`aria-live`). `onUsePassword` — parolli kirish (admin/eski hisoblar) uchun zaxira yo'l.
 */
export function EmailCodeForm({
  initialEmail,
  callbackUrl,
  onUsePassword,
  className,
}: {
  initialEmail: string;
  callbackUrl?: string;
  onUsePassword: (email: string) => void;
  className?: string;
}) {
  const t = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: initialEmail },
  });

  const message = errorText(errors.email?.message) ?? (serverError ? errorText(serverError) : null);

  const send = handleSubmit(async ({ email }) => {
    setServerError(undefined);
    setPending(true);
    try {
      await authClient.requestOtp(email, locale as ApiLocale);
    } catch (error) {
      const code = errorCodeOf(error);
      // Kod yaqinda yuborilgan: kiritish sahifasiga o'tamiz (taymer o'sha yerda).
      if (code !== "otp_cooldown") {
        setServerError(code);
        setPending(false);
        return;
      }
    }
    const query = new URLSearchParams({ email, ...(callbackUrl && { callbackUrl }) });
    router.push(`${ROUTES.otp}?${query}`);
  });

  return (
    <div data-testid="email-step" className={cn("flex flex-col", className)}>
      <form noValidate onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only text-[14px] font-semibold lg:not-sr-only">
          {t("emailLabel")}
        </label>
        <div className="flex gap-2 lg:flex-col lg:gap-3">
          <input
            id={inputId}
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            className={cn(
              "bg-auth-panel text-auth-text placeholder:text-auth-subtle h-[54px] min-w-0 flex-1 rounded-[14px] border-[1.5px] px-4 text-base outline-none lg:h-[52px] lg:flex-none",
              "focus-visible:border-brand focus-visible:ring-brand-ring focus-visible:ring-4",
              message ? "border-danger" : "border-auth-field",
            )}
            {...register("email")}
          />
          <AuthButton type="submit" variant="soft" loading={pending} className="lg:w-full">
            <span className="lg:hidden">{t("getCode")}</span>
            <span className="hidden lg:inline">{t("sendCode")}</span>
          </AuthButton>
        </div>
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-danger text-[13px] empty:hidden"
        >
          {message}
        </p>
      </form>
      <p className="text-auth-subtle mt-3 hidden text-[13px] lg:block">{t("codeHint")}</p>
      <button
        type="button"
        onClick={handleSubmit(({ email }) => onUsePassword(email))}
        className="text-brand-text focus-visible:ring-brand-ring mt-1 inline-flex min-h-11 items-center self-start rounded-lg text-[13px] font-semibold outline-none hover:underline focus-visible:ring-4"
      >
        {t("usePassword")}
      </button>
    </div>
  );
}
