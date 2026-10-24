"use client";

import { useEffect, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { PASSWORD_PROVIDER } from "@/lib/auth/config";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";
import { FormAlert } from "./FormAlert";

type ApiLocale = Parameters<typeof authClient.requestOtp>[1];

/** Parolli kirish (admin va eski hisoblar) yoki parolsiz (emailga kod). Xatolar forma ustida, forma o'zgarmaydi. */
export function PasswordStep({
  email,
  callbackUrl,
  onChangeEmail,
}: {
  email: string;
  callbackUrl?: string;
  onChangeEmail: () => void;
}) {
  const t = useTranslations("authForm");
  const locale = useLocale();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const [formError, setFormError] = useState<string>();
  const [codePending, setCodePending] = useState(false);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email, password: "" },
  });

  useEffect(() => setFocus("password"), [setFocus]);

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(undefined);
    const result = await signIn(PASSWORD_PROVIDER, {
      redirect: false,
      mode: "login",
      email,
      password,
    }).catch(() => ({ error: "network", code: "network_error" }));
    if (result?.error) {
      setFormError(result.code ?? "unknown");
      return;
    }
    await completeSignIn(callbackUrl);
  });

  /** Kod yaqinda yuborilgan bo'lsa ham kiritish sahifasiga o'tamiz (taymer o'sha yerda). */
  const sendCode = async () => {
    setFormError(undefined);
    setCodePending(true);
    try {
      await authClient.requestOtp(email, locale as ApiLocale);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code !== "otp_cooldown") {
        setFormError(code);
        setCodePending(false);
        return;
      }
    }
    const query = new URLSearchParams({ email, ...(callbackUrl && { callbackUrl }) });
    router.push(`${ROUTES.otp}?${query}`);
  };

  const busy = isSubmitting || codePending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium" data-testid="login-email">
          {email}
        </span>
        <button
          type="button"
          onClick={onChangeEmail}
          className="text-link inline-flex min-h-11 shrink-0 items-center hover:underline"
        >
          {t("changeEmail")}
        </button>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="login-form">
        {formError && <FormAlert>{errorText(formError)}</FormAlert>}
        {/* Parol menejeri akkaunt nomini topishi uchun; ko'rinmaydi. */}
        <input
          type="email"
          autoComplete="username"
          value={email}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
        <PasswordInput
          label={t("password")}
          autoComplete="current-password"
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          className="h-11"
          error={errorText(errors.password?.message)}
          {...register("password")}
        />
        <Button type="submit" size="lg" loading={isSubmitting} disabled={busy}>
          {t("loginSubmit")}
        </Button>
      </form>
      <Button
        variant="secondary"
        size="lg"
        loading={codePending}
        disabled={busy}
        onClick={sendCode}
      >
        {t("passwordless")}
      </Button>
      <Link
        href={ROUTES.forgotPassword}
        className="text-link inline-flex min-h-11 items-center justify-center text-sm hover:underline"
      >
        {t("forgotLink")}
      </Link>
    </div>
  );
}
