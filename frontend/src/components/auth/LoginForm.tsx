"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { PASSWORD_PROVIDER } from "@/lib/auth/config";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";
import { FormAlert } from "./FormAlert";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("authForm");
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
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

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="login-form">
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
      <PasswordInput
        label={t("password")}
        autoComplete="current-password"
        showLabel={t("showPassword")}
        hideLabel={t("hidePassword")}
        error={errorText(errors.password?.message)}
        {...register("password")}
      />
      <Link href={ROUTES.forgotPassword} className="text-link w-fit text-sm hover:underline">
        {t("forgotLink")}
      </Link>
      <Button type="submit" size="lg" loading={isSubmitting}>
        {t("loginSubmit")}
      </Button>
    </form>
  );
}
