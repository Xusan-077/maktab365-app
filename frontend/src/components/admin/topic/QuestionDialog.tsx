"use client";

import { useRef, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, get, useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { getAdminApi } from "@/lib/admin/api";
import { adminKeys } from "@/lib/admin/queries";
import { OPTION_LETTERS, toQuestionForm, toQuestionInput } from "@/lib/admin/questions";
import type { AdminQuestion } from "@/lib/admin/types";
import { cn } from "@/lib/utils/cn";
import { DIFFICULTIES, questionSchema, type QuestionFormValues } from "@/lib/validation/questions";
import { LocalizedFields } from "../LocalizedFields";
import { useAdminErrorText, useAdminFieldErrorText } from "../useAdminErrorText";

const resolver = yupResolver(questionSchema) as unknown as Resolver<QuestionFormValues>;

export interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  /** Berilsa — tahrirlash, aks holda yangi savol (ro'yxat oxiriga). */
  question?: AdminQuestion;
}

/** Ixtiyoriy rasm: `uploads/` (kind=image) ga yuklanadi, formada faqat yo'l saqlanadi. */
function ImageField({
  path,
  initialUrl,
  onChange,
  disabled,
}: {
  path: string;
  initialUrl: string | null;
  onChange: (path: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.questions.form");
  const errorText = useAdminErrorText();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const upload = useMutation({
    mutationFn: (file: File) => getAdminApi().upload(file, "image"),
    onSuccess: (result) => {
      setPreview(result.url);
      onChange(result.path);
    },
  });
  const shown = path ? preview : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-foreground text-sm font-medium">{t("image")}</span>
      <div className="flex flex-wrap items-center gap-3">
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element -- admin oldindan ko'rish, CDN rasmi
          <img
            src={shown}
            alt=""
            className="border-border h-20 w-auto max-w-40 rounded-lg border object-contain"
          />
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={upload.isPending}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {!upload.isPending && <ImagePlus className="size-4" aria-hidden />}
          {shown ? t("imageReplace") : t("imagePick")}
        </Button>
        {shown && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange("")}>
            <X className="size-4" aria-hidden />
            {t("imageRemove")}
          </Button>
        )}
      </div>
      {upload.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(upload.error)}
        </p>
      )}
    </div>
  );
}

function QuestionForm({
  topicId,
  question,
  onDone,
}: Omit<QuestionDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations("admin.questions");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuestionFormValues>({ resolver, defaultValues: toQuestionForm(question) });

  const save = useMutation({
    mutationFn: (values: QuestionFormValues) => {
      const api = getAdminApi();
      const input = toQuestionInput(values);
      return question ? api.updateQuestion(question.id, input) : api.createQuestion(topicId, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.topicQuestions(topicId) });
      onDone();
    },
  });

  /** Yup xabar kaliti → matn. */
  const message = (path: string): string | undefined => {
    const key: unknown = get(errors, path)?.message;
    if (typeof key !== "string" || !key) return undefined;
    return t.has(`errors.${key}`) ? t(`errors.${key}`) : t("errors.invalid");
  };
  const serverError =
    fieldErrorText(save.error, "options") ??
    fieldErrorText(save.error, "text") ??
    fieldErrorText(save.error, "image");

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="flex flex-col gap-5"
      data-testid="question-form"
    >
      <Controller
        control={control}
        name="text"
        render={({ field }) => (
          <LocalizedFields
            label={t("form.text")}
            name="question-text"
            value={field.value}
            onChange={field.onChange}
            error={message("text.uz") ?? message("text.ru") ?? message("text.en")}
            disabled={save.isPending}
          />
        )}
      />

      <Controller
        control={control}
        name="image"
        render={({ field }) => (
          <ImageField
            path={field.value}
            initialUrl={question?.image_url ?? null}
            onChange={field.onChange}
            disabled={save.isPending}
          />
        )}
      />

      <Controller
        control={control}
        name="difficulty"
        render={({ field }) => (
          <SegmentedControl
            legend={t("difficulty.label")}
            value={field.value}
            onChange={field.onChange}
            options={DIFFICULTIES.map((value) => ({ value, label: t(`difficulty.${value}`) }))}
          />
        )}
      />

      <fieldset className="flex flex-col gap-4" disabled={save.isPending}>
        <legend className="text-foreground mb-1 text-sm font-medium">{t("form.options")}</legend>
        <p className="text-muted -mt-2 text-sm">{t("form.correctHint")}</p>
        {OPTION_LETTERS.map((letter, index) => (
          <div
            key={letter}
            className="border-border flex flex-col gap-2 rounded-lg border p-3"
            data-testid="question-option"
          >
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                value={String(index)}
                className="accent-primary-600 size-4"
                {...register("correct")}
              />
              {t("form.correctOption", { letter })}
            </label>
            <Controller
              control={control}
              name={`options.${index}.text`}
              render={({ field }) => (
                <LocalizedFields
                  label={t("form.option", { letter })}
                  name={`question-option-${index}`}
                  value={field.value}
                  onChange={field.onChange}
                  error={
                    message(`options.${index}.text.uz`) ??
                    message(`options.${index}.text.ru`) ??
                    message(`options.${index}.text.en`)
                  }
                />
              )}
            />
          </div>
        ))}
        {errors.correct && (
          <p role="alert" className="text-danger text-sm">
            {message("correct")}
          </p>
        )}
      </fieldset>

      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            label={t("form.active")}
            description={t("form.activeHint")}
          />
        )}
      />

      {save.isError && (
        <p role="alert" className="text-danger text-sm">
          {serverError ?? errorText(save.error)}
        </p>
      )}
      <div className={cn("flex justify-end gap-2")}>
        <Button variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {question ? tc("save") : tc("create")}
        </Button>
      </div>
    </form>
  );
}

/** Savol qo'shish / tahrirlash: matn, rasm, qiyinlik, 4 variant va to'g'ri javob (radio). */
export function QuestionDialog({ open, onOpenChange, topicId, question }: QuestionDialogProps) {
  const t = useTranslations("admin.questions.form");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(question ? "editTitle" : "createTitle")}
      className="sm:max-w-2xl"
    >
      {/* Yopilganda forma holati tozalansin: ochiq bo'lgandagina chiziladi. */}
      {open && (
        <QuestionForm topicId={topicId} question={question} onDone={() => onOpenChange(false)} />
      )}
    </Dialog>
  );
}
