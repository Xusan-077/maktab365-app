"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/FormAlert";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { IDENTITIES_KEY, useIdentities } from "@/hooks/useIdentities";
import { useToast } from "@/hooks/useToast";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import {
  changePasswordSchema,
  fieldOfErrorCode,
  setPasswordSchema,
  type ChangePasswordValues,
  type SetPasswordValues,
} from "@/lib/validation/auth";
import { LinkedIdentities } from "./LinkedIdentities";

const EMPTY: ChangePasswordValues = { currentPassword: "", newPassword: "", passwordConfirm: "" };

function ChangePasswordForm() {
  const t = useTranslations("settings.security");
  const tf = useTranslations("authForm");
  const errorText = useAuthErrorText();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(undefined);
    try {
      await authClient.changePassword({ currentPassword, newPassword });
      reset(EMPTY);
      toast({ variant: "success", title: t("changed"), description: t("changedHint") });
    } catch (error) {
      const code = errorCodeOf(error);
      const field = fieldOfErrorCode(code);
      if (field === "currentPassword") setError("currentPassword", { message: code });
      else if (field === "password") setError("newPassword", { message: code });
      else setFormError(code);
    }
  });

  const passwordProps = { showLabel: tf("showPassword"), hideLabel: tf("hidePassword") };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">{t("changePassword")}</h3>
      {formError && <FormAlert>{errorText(formError)}</FormAlert>}
      <PasswordInput
        label={t("currentPassword")}
        autoComplete="current-password"
        error={errorText(errors.currentPassword?.message)}
        {...passwordProps}
        {...register("currentPassword")}
      />
      <PasswordInput
        label={t("newPassword")}
        autoComplete="new-password"
        hint={tf("passwordHint")}
        error={errorText(errors.newPassword?.message)}
        {...passwordProps}
        {...register("newPassword")}
      />
      <PasswordInput
        label={t("passwordConfirm")}
        autoComplete="new-password"
        error={errorText(errors.passwordConfirm?.message)}
        {...passwordProps}
        {...register("passwordConfirm")}
      />
      <div>
        <Button type="submit" loading={isSubmitting}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}

/** Parolsiz akkaunt (Google / Telegram / email kodi) uchun birinchi parol. */
function SetPasswordForm() {
  const t = useTranslations("settings.security.setPassword");
  const tf = useTranslations("authForm");
  const errorText = useAuthErrorText();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({
    resolver: yupResolver(setPasswordSchema),
    defaultValues: { newPassword: "", passwordConfirm: "" },
  });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setFormError(undefined);
    try {
      await authClient.setPassword(newPassword);
      reset();
      await queryClient.invalidateQueries({ queryKey: IDENTITIES_KEY });
      toast({ variant: "success", title: t("done") });
    } catch (error) {
      const code = errorCodeOf(error);
      if (fieldOfErrorCode(code) === "password") setError("newPassword", { message: code });
      else setFormError(code);
    }
  });

  const passwordProps = { showLabel: tf("showPassword"), hideLabel: tf("hidePassword") };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="set-password">
      <h3 className="text-base font-semibold">{t("title")}</h3>
      <p className="text-muted text-sm">{t("text")}</p>
      {formError && <FormAlert>{errorText(formError)}</FormAlert>}
      <PasswordInput
        label={t("newPassword")}
        autoComplete="new-password"
        hint={tf("passwordHint")}
        error={errorText(errors.newPassword?.message)}
        {...passwordProps}
        {...register("newPassword")}
      />
      <PasswordInput
        label={t("passwordConfirm")}
        autoComplete="new-password"
        error={errorText(errors.passwordConfirm?.message)}
        {...passwordProps}
        {...register("passwordConfirm")}
      />
      <div>
        <Button type="submit" loading={isSubmitting}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}

function LogoutAllButton() {
  const t = useTranslations("settings.security");
  const locale = useLocale();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const logoutAll = async () => {
    setPending(true);
    try {
      await authClient.logoutAll();
      await signOut({ redirectTo: `/${locale}` });
    } catch {
      toast({ variant: "error", title: t("logoutAllFailed") });
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" loading={pending} onClick={() => void logoutAll()}>
          <LogOut className="size-4" aria-hidden />
          {t("logoutAll")}
        </Button>
      </div>
      <p className="text-muted text-sm">{t("logoutAllHint")}</p>
    </div>
  );
}

/**
 * Sozlamalar → Xavfsizlik: ulangan kirish usullari, parol (almashtirish yoki birinchi marta
 * o'rnatish) va barcha qurilmalardan chiqish. `googleClientId` — Google'ni ulash tugmasi uchun.
 */
export function SecuritySettings({ googleClientId }: { googleClientId?: string }) {
  const t = useTranslations("settings.security");
  const { data } = useSession();
  const { data: identities } = useIdentities();
  if (typeof data?.user.onboarded !== "boolean") return null;

  return (
    <section aria-labelledby="settings-security" className="flex flex-col gap-5">
      <h2 id="settings-security" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <LinkedIdentities googleClientId={googleClientId} />
      {identities && !identities.has_password ? <SetPasswordForm /> : <ChangePasswordForm />}
      <LogoutAllButton />
    </section>
  );
}
