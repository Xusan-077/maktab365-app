"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { Button } from "@/components/ui/Button";
import { controlClasses, Field } from "@/components/ui/Field";
import { useAppBase } from "@/hooks/useAppBase";
import { useToast } from "@/hooks/useToast";
import { getApi } from "@/lib/api";
import { cn } from "@/lib/utils/cn";
import {
  feedbackSchema,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
} from "@/lib/validation/feedback";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/types/feedback";

type FeedbackFormValues = { kind: FeedbackKind; message: string };

const pillClasses =
  "border-border bg-surface hover:bg-subtle has-[:checked]:border-primary-600 has-[:checked]:bg-primary-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors select-none";

/** Panel ichidagi "Yordam": tezkor maslahatlar va savol, taklif yoki xatolik haqida xabar yuborish. */
export function HelpView() {
  const t = useTranslations("panel.helpPage");
  const base = useAppBase();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: yupResolver(feedbackSchema) as unknown as Resolver<FeedbackFormValues>,
    defaultValues: { kind: "question", message: "" },
  });

  const send = useMutation({
    mutationFn: (values: FeedbackFormValues) => getApi().submitFeedback(values),
    onSuccess: () => {
      toast({ variant: "success", title: t("sent"), description: t("sentHint") });
      reset({ kind: "question", message: "" });
    },
    onError: () => toast({ variant: "error", title: t("sendFailed") }),
  });

  const fieldError = (message?: string) =>
    message
      ? t(`errors.${message}` as "errors.messageRequired", {
          min: FEEDBACK_MESSAGE_MIN,
          max: FEEDBACK_MESSAGE_MAX,
        })
      : undefined;

  const tips = [
    t("tips.search"),
    t("tips.bookmarks"),
    ...(base === "ustoz" ? [t("tips.present")] : [t("tips.progress")]),
  ];

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} description={t("lead")} />

      <div className={`${PAGE_STACK} max-w-2xl`}>
        <section aria-labelledby="help-tips" className="flex flex-col gap-3">
          <h2 id="help-tips" className="text-xl font-semibold">
            {t("tipsTitle")}
          </h2>
          <ul className="text-muted flex list-disc flex-col gap-2 pl-5">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="help-feedback" className="flex flex-col gap-4">
          <h2 id="help-feedback" className="text-xl font-semibold">
            {t("formTitle")}
          </h2>
          <form
            noValidate
            onSubmit={handleSubmit((values) => send.mutate(values))}
            className="flex flex-col gap-5"
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("kindLabel")}</legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_KINDS.map((kind) => (
                  <label key={kind} className={pillClasses}>
                    <input type="radio" value={kind} className="sr-only" {...register("kind")} />
                    {t(`kinds.${kind}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field
              id="feedback-message"
              label={t("messageLabel")}
              hint={t("messageHint", { min: FEEDBACK_MESSAGE_MIN, max: FEEDBACK_MESSAGE_MAX })}
              error={fieldError(errors.message?.message)}
            >
              <textarea
                id="feedback-message"
                rows={6}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={
                  errors.message ? "feedback-message-error" : "feedback-message-hint"
                }
                className={cn(controlClasses, "h-auto min-h-32 py-2")}
                {...register("message")}
              />
            </Field>

            <div>
              <Button type="submit" size="lg" loading={send.isPending}>
                {t("submit")}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
