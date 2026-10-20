"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import {
  fieldOfErrorCode,
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/validation/auth";
import { AuthCard } from "./AuthCard";
import { FormAlert } from "./FormAlert";

const LINK_ERRORS = new Set(["invalid_token", "token_expired"]);

/** Xatdagi havola (`?token=`) bo'yicha yangi parol o'rnatish. */
export function ResetPasswordView() {
  const t = useTranslations("authForm");
  const errorText = useAuthErrorText();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(undefined);
    try {
      await authClient.resetPassword(token, password);
      setDone(true);
    } catch (error) {
      const code = errorCodeOf(error);
      if (fieldOfErrorCode(code) === "password") setError("password", { message: code });
      else setFormError(code);
    }
  });

  const requestNew = (
    <Link href={ROUTES.forgotPassword} className={buttonVariants({ size: "lg" })}>
      {t("reset.requestNew")}
    </Link>
  );

  if (!token) {
    return (
      <AuthCard title={t("reset.failedTitle")}>
        <FormAlert>{t("reset.missingToken")}</FormAlert>
        {requestNew}
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title={t("reset.successTitle")}>
        <FormAlert variant="success">{t("reset.successText")}</FormAlert>
        <Link href={ROUTES.login} className={buttonVariants({ size: "lg" })}>
          {t("reset.goToLogin")}
        </Link>
      </AuthCard>
    );
  }

  if (formError && LINK_ERRORS.has(formError)) {
    return (
      <AuthCard title={t("reset.failedTitle")}>
        <FormAlert>{errorText(formError)}</FormAlert>
        {requestNew}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("reset.title")} text={t("reset.text")}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {formError && <FormAlert>{errorText(formError)}</FormAlert>}
        <PasswordInput
          label={t("reset.newPassword")}
          autoComplete="new-password"
          hint={t("passwordHint")}
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          error={errorText(errors.password?.message)}
          {...register("password")}
        />
        <PasswordInput
          label={t("passwordConfirm")}
          autoComplete="new-password"
          showLabel={t("showPassword")}
          hideLabel={t("hidePassword")}
          error={errorText(errors.passwordConfirm?.message)}
          {...register("passwordConfirm")}
        />
        <Button type="submit" size="lg" loading={isSubmitting}>
          {t("reset.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
