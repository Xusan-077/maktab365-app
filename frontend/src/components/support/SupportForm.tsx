"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { controlClasses, Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/types";
import { buildSupportInput, type SupportFormValues } from "@/lib/support/request";
import { cn } from "@/lib/utils/cn";
import {
  createSupportSchema,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
} from "@/lib/validation/support";
import { SUPPORT_KINDS, type SupportKind } from "@/types/support";

const pillClasses =
  "border-border bg-surface hover:bg-subtle has-[:checked]:border-primary-600 has-[:checked]:bg-primary-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors select-none";

export interface SupportFormProps {
  /** Forma id'lari prefiksi (sahifada bir nechta forma bo'lsa to'qnashmasligi uchun). */
  idPrefix: string;
  defaultKind?: SupportKind;
  /** Mavzu identifikatori ("Xato topdingizmi?" havolasidan). */
  topic?: string;
  /** `true` — yuborilayotgan paytdagi sahifa manzili (`window.location`) murojaatga qo'shiladi. */
  attachPageUrl?: boolean;
  /** Muvaffaqiyat holatidagi tugma (masalan, dialogni yopish); berilmasa "Yana xabar yuborish". */
  onDone?: () => void;
  doneLabel?: string;
}

/** "Yordam va aloqa" formasi: marketing sahifasi, panel va mavzudagi "Xato topdingizmi?" dialogi. */
export function SupportForm({
  idPrefix,
  defaultKind = "question",
  topic,
  attachPageUrl = false,
  onDone,
  doneLabel,
}: SupportFormProps) {
  const t = useTranslations("support");
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);

  const schema = useMemo(() => createSupportSchema({ emailRequired: !signedIn }), [signedIn]);
  const emptyValues: SupportFormValues = { kind: defaultKind, email: "", message: "", website: "" };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupportFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<SupportFormValues>,
    defaultValues: emptyValues,
  });

  const send = useMutation({
    mutationFn: async (values: SupportFormValues) => {
      const input = buildSupportInput(values, {
        topic,
        pageUrl: attachPageUrl ? window.location.href : undefined,
      });
      // Honeypot to'ldirilgan (bot): yubormaymiz, lekin muvaffaqiyat ko'rsatamiz.
      if (input) await getApi().sendSupport(input);
    },
    onSuccess: () => {
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: queryKeys.mySupport() });
    },
  });

  const fieldError = (message?: string) =>
    message
      ? t(`errors.${message}` as "errors.messageRequired", {
          min: SUPPORT_MESSAGE_MIN,
          max: SUPPORT_MESSAGE_MAX,
        })
      : undefined;

  if (sent) {
    return (
      <div
        role="status"
        data-testid="support-sent"
        className="border-border bg-surface flex flex-col items-start gap-3 rounded-xl border p-5"
      >
        <CheckCircle2 className="text-success size-8" aria-hidden />
        <div>
          <p className="text-lg font-semibold">{t("sentTitle")}</p>
          <p className="text-muted mt-1">{t("sentHint")}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            if (onDone) {
              onDone();
              return;
            }
            reset(emptyValues);
            send.reset();
            setSent(false);
          }}
        >
          {doneLabel ?? t("sendAnother")}
        </Button>
      </div>
    );
  }

  const sendError =
    send.error instanceof ApiError && send.error.code === "throttled"
      ? t("errors.throttled")
      : send.error
        ? t("errors.sendFailed")
        : null;

  return (
    <form
      noValidate
      data-testid="support-form"
      onSubmit={handleSubmit((values) => send.mutate(values))}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("kindLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_KINDS.map((kind) => (
            <label key={kind} className={pillClasses}>
              <input type="radio" value={kind} className="sr-only" {...register("kind")} />
              {t(`kinds.${kind}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {!signedIn && (
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          label={t("emailLabel")}
          hint={t("emailHint")}
          error={fieldError(errors.email?.message)}
          {...register("email")}
        />
      )}

      <Field
        id={`${idPrefix}-message`}
        label={t("messageLabel")}
        hint={t("messageHint", { min: SUPPORT_MESSAGE_MIN, max: SUPPORT_MESSAGE_MAX })}
        error={fieldError(errors.message?.message)}
      >
        <textarea
          id={`${idPrefix}-message`}
          rows={6}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={
            errors.message ? `${idPrefix}-message-error` : `${idPrefix}-message-hint`
          }
          className={cn(controlClasses, "h-auto min-h-32 py-2")}
          {...register("message")}
        />
      </Field>

      {/* Honeypot: odamga ko'rinmaydi va Tab bilan yetib bo'lmaydi; botlar to'ldiradi. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {t("honeypotLabel")}
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      {sendError && (
        <p role="alert" className="text-danger text-sm">
          {sendError}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" loading={send.isPending}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
