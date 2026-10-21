"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useCompleteSignIn } from "@/hooks/useCompleteSignIn";
import { useToast } from "@/hooks/useToast";
import { PASSWORD_PROVIDER } from "@/lib/auth/config";
import { fieldOfErrorCode, registerSchema, type RegisterValues } from "@/lib/validation/auth";
import { FormAlert } from "./FormAlert";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("authForm");
  const locale = useLocale();
  const errorText = useAuthErrorText();
  const completeSignIn = useCompleteSignIn();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: yupResolver(registerSchema),
    defaultValues: { email: "", password: "", passwordConfirm: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(undefined);
    const result = await signIn(PASSWORD_PROVIDER, {
      redirect: false,
      mode: "register",
      email,
      password,
      locale,
    }).catch(() => ({ error: "network", code: "network_error" }));
    if (result?.error) {
      const code = result.code ?? "unknown";
      const field = fieldOfErrorCode(code);
      if (field === "email" || field === "password") {
        setError(field, { message: code }, { shouldFocus: true });
      } else {
        setFormError(code);
      }
      return;
    }
    toast({ variant: "success", title: t("registered") });
    await completeSignIn(callbackUrl);
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      data-testid="register-form"
    >
      {formError && <FormAlert>{errorText(formError)}</FormAlert>}
      <Input
        label={t("email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        className="h-11"
        placeholder={t("emailPlaceholder")}
        error={errorText(errors.email?.message)}
        {...register("email")}
      />
      <PasswordInput
        label={t("password")}
        autoComplete="new-password"
        hint={t("passwordHint")}
        showLabel={t("showPassword")}
        hideLabel={t("hidePassword")}
        className="h-11"
        error={errorText(errors.password?.message)}
        {...register("password")}
      />
      <PasswordInput
        label={t("passwordConfirm")}
        autoComplete="new-password"
        showLabel={t("showPassword")}
        hideLabel={t("hidePassword")}
        className="h-11"
        error={errorText(errors.passwordConfirm?.message)}
        {...register("passwordConfirm")}
      />
      <Button type="submit" size="lg" loading={isSubmitting}>
        {t("registerSubmit")}
      </Button>
    </form>
  );
}
