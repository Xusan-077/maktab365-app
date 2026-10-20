"use client";

import { useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Mail, Send, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/FormAlert";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { TelegramLoginButton, type TelegramUser } from "@/components/auth/TelegramLoginButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { IDENTITIES_KEY, useIdentities } from "@/hooks/useIdentities";
import { useToast } from "@/hooks/useToast";
import {
  authClient,
  errorCodeOf,
  type IdentityList,
  type LinkProvider,
  type LinkRequest,
} from "@/lib/auth/client";
import { TELEGRAM_BOT_USERNAME } from "@/lib/auth/config";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";
import { GoogleLinkButton } from "./GoogleLinkButton";

type Identity = IdentityList["identities"][number];

const PROVIDER_ICON = {
  password: KeyRound,
  google: Mail,
  telegram: Send,
  email_otp: Mail,
} as const;

/** Email orqali kod bilan ulash: email → kod (6 katak) → ulanadi. */
function OtpLinkForm({ onLinked }: { onLinked: () => void }) {
  const t = useTranslations("settings.security.methods");
  const to = useTranslations("authForm.otp");
  const tf = useTranslations("authForm");
  const locale = useLocale();
  const errorText = useAuthErrorText();
  const [email, setEmail] = useState<string>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const request = handleSubmit(async (values) => {
    setError(undefined);
    try {
      await authClient.requestOtp(
        values.email,
        locale as Parameters<typeof authClient.requestOtp>[1],
      );
      setEmail(values.email);
    } catch (failure) {
      setError(errorCodeOf(failure));
    }
  });

  const link = async (code: string) => {
    if (!email) return;
    setError(undefined);
    try {
      await authClient.linkIdentity("email_otp", { email, code });
      onLinked();
    } catch (failure) {
      setError(errorCodeOf(failure));
      setAttempt((value) => value + 1);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="otp-link">
      <h4 className="text-sm font-medium">{t("addEmailCode")}</h4>
      {error && <FormAlert>{errorText(error)}</FormAlert>}
      {email ? (
        <>
          <p className="text-muted text-sm">{to("text", { email })}</p>
          <OtpCodeInput
            key={attempt}
            label={to("codeLabel")}
            onComplete={(code) => void link(code)}
            invalid={Boolean(error)}
          />
        </>
      ) : (
        <form noValidate onSubmit={request} className="flex flex-col gap-3">
          <Input
            label={tf("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={tf("emailPlaceholder")}
            error={errorText(errors.email?.message)}
            {...register("email")}
          />
          <div>
            <Button type="submit" variant="secondary" loading={isSubmitting}>
              {tf("emailCodeSubmit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Sozlamalar → Xavfsizlik: ulangan kirish usullari, yangisini qo'shish va o'chirish. */
export function LinkedIdentities({ googleClientId }: { googleClientId?: string }) {
  const t = useTranslations("settings.security.methods");
  const errorText = useAuthErrorText();
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();
  const { toast } = useToast();
  const { data, isError } = useIdentities();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  if (isError) return <FormAlert>{t("loadFailed")}</FormAlert>;
  if (!data) return null;

  const linked = new Set<string>(data.identities.map((identity) => identity.provider));
  const onlyOne = data.identities.length <= 1;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: IDENTITIES_KEY });
    // Provayder email bergan bo'lsa sessiyadagi email tasdig'i yangilanadi.
    await updateSession({ refresh: "account" });
  };

  const link = async (provider: LinkProvider, body: LinkRequest) => {
    setError(undefined);
    setBusy(provider);
    try {
      await authClient.linkIdentity(provider, body);
      await refresh();
      toast({ variant: "success", title: t("linked") });
    } catch (failure) {
      setError(errorCodeOf(failure));
    } finally {
      setBusy(undefined);
    }
  };

  const remove = async (identity: Identity) => {
    setError(undefined);
    setBusy(identity.id);
    try {
      await authClient.unlinkIdentity(identity.id);
      await refresh();
      toast({ variant: "success", title: t("removed") });
    } catch (failure) {
      setError(errorCodeOf(failure));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="linked-identities">
      <h3 className="text-base font-semibold">{t("title")}</h3>
      <p className="text-muted text-sm">{t("text")}</p>
      {error && <FormAlert>{errorText(error)}</FormAlert>}
      <ul className="flex flex-col gap-2">
        {data.identities.map((identity) => {
          const Icon = PROVIDER_ICON[identity.provider as keyof typeof PROVIDER_ICON] ?? Mail;
          return (
            <li
              key={identity.id}
              className="border-border bg-surface flex items-center gap-3 rounded-lg border p-3"
            >
              <Icon className="text-muted size-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t(`providers.${identity.provider}` as "providers.google")}
                </p>
                {identity.email && <p className="text-muted truncate text-sm">{identity.email}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={busy === identity.id}
                disabled={onlyOne}
                title={onlyOne ? t("lastHint") : undefined}
                onClick={() => void remove(identity)}
              >
                <Trash2 className="size-4" aria-hidden />
                {t("remove")}
              </Button>
            </li>
          );
        })}
      </ul>
      {onlyOne && <p className="text-muted text-sm">{t("lastHint")}</p>}

      {(!linked.has("google") || !linked.has("telegram") || !linked.has("email_otp")) && (
        <div className="flex flex-col gap-4">
          <h4 className="text-sm font-medium">{t("add")}</h4>
          {!linked.has("google") && googleClientId && (
            <GoogleLinkButton
              clientId={googleClientId}
              onCredential={(idToken) => void link("google", { id_token: idToken })}
              onError={() => setError("provider_not_configured")}
            />
          )}
          {!linked.has("telegram") && (
            <TelegramLoginButton
              botUsername={TELEGRAM_BOT_USERNAME}
              label={t("addTelegram")}
              onAuth={(user: TelegramUser) => void link("telegram", user)}
            />
          )}
          {!linked.has("email_otp") && <OtpLinkForm onLinked={() => void refresh()} />}
        </div>
      )}
    </div>
  );
}
