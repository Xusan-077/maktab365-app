"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";
import { AuthCard } from "./AuthCard";
import { FormAlert } from "./FormAlert";

/** Parolni tiklash havolasini so'rash. Javob akkaunt bor-yo'qligidan qat'i nazar bir xil. */
export function ForgotPasswordView() {
  const t = useTranslations("authForm");
  const errorText = useAuthErrorText();
  const [sentTo, setSentTo] = useState<string>();
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
      await authClient.forgotPassword(email);
      setSentTo(email);
    } catch (error) {
      setFormError(errorCodeOf(error));
    }
  });

  const backLink = (
    <Link href={ROUTES.login} className={buttonVariants({ variant: "ghost", size: "lg" })}>
      {t("forgot.backToLogin")}
    </Link>
  );

  if (sentTo) {
    return (
      <AuthCard title={t("forgot.sentTitle")}>
        <FormAlert variant="success">{t("forgot.sentText", { email: sentTo })}</FormAlert>
        {backLink}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("forgot.title")} text={t("forgot.text")}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
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
        <Button type="submit" size="lg" loading={isSubmitting}>
          {t("forgot.submit")}
        </Button>
      </form>
      {backLink}
    </AuthCard>
  );
}
