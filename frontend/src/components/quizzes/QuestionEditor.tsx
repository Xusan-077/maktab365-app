"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Controller, useFieldArray, useFormContext, type FieldErrors } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { canAddOption, canRemoveOption, ensureOneCorrect } from "@/lib/quizzes/form";
import { QUIZ_LIMITS } from "@/lib/quizzes/types";
import { cn } from "@/lib/utils/cn";
import type { QuizFormValues } from "@/lib/validation/quiz";
import { ImageField } from "./ImageField";

interface Props {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

type QuestionErrors = FieldErrors<QuizFormValues>["questions"];

/** Massiv darajasidagi xato RHF'da `message` yoki `root.message` ostida bo'ladi. */
function arrayErrorKey(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { message, root } = error as { message?: unknown; root?: { message?: unknown } };
  const found = message ?? root?.message;
  return typeof found === "string" ? found : undefined;
}

/** Bitta savol: matn, rasm, 2–6 variant va to'g'ri javob tanlash. */
export function QuestionEditor({ index, total, onMove, onRemove }: Props) {
  const t = useTranslations("quizzes.form");
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<QuizFormValues>();
  const options = useFieldArray({ control, name: `questions.${index}.options` });

  const questionErrors = (errors.questions as QuestionErrors)?.[index];
  const errorText = (key: string | undefined) =>
    key
      ? t(`errors.${key}`, { min: QUIZ_LIMITS.optionsMin, max: QUIZ_LIMITS.optionsMax })
      : undefined;
  const optionsError = errorText(arrayErrorKey(questionErrors?.options));

  function markCorrect(correct: number) {
    options.fields.forEach((_, i) =>
      setValue(`questions.${index}.options.${i}.isCorrect`, i === correct, { shouldDirty: true }),
    );
  }

  function removeOption(optionIndex: number) {
    options.remove(optionIndex);
    // `remove` keyingi renderda qo'llanadi: to'g'ri javob yo'qolsa, birinchi variant to'g'ri bo'ladi.
    queueMicrotask(() => {
      const current = getValues(`questions.${index}.options`);
      setValue(`questions.${index}.options`, ensureOneCorrect(current), { shouldDirty: true });
    });
  }

  return (
    <Card className="flex flex-col gap-4" data-testid={`question-${index}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t("question.heading", { number: index + 1 })}</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={t("question.moveUp")}
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={t("question.moveDown")}
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={total === 1}
            onClick={() => onRemove(index)}
            aria-label={t("question.remove")}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Textarea
        rows={2}
        label={t("question.text")}
        placeholder={t("question.textPlaceholder")}
        maxLength={QUIZ_LIMITS.questionText}
        error={errorText(questionErrors?.text?.message)}
        {...register(`questions.${index}.text`)}
      />

      <Controller
        control={control}
        name={`questions.${index}.image`}
        render={({ field }) => (
          <ImageField
            label={t("question.image")}
            value={{
              path: field.value ?? "",
              url: getValues(`questions.${index}.imageUrl`) ?? null,
            }}
            onChange={(image) => {
              field.onChange(image.path);
              setValue(`questions.${index}.imageUrl`, image.url, { shouldDirty: true });
            }}
          />
        )}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("options.legend")}</legend>
        {options.fields.map((field, optionIndex) => (
          <div key={field.id} className="flex items-start gap-2">
            <Controller
              control={control}
              name={`questions.${index}.options.${optionIndex}.isCorrect`}
              render={({ field: correct }) => (
                <label
                  className={cn(
                    "mt-0.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border sm:size-10",
                    correct.value
                      ? "border-success bg-success-soft text-success-soft-foreground"
                      : "border-border bg-surface hover:bg-subtle",
                  )}
                >
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    checked={correct.value}
                    onChange={() => markCorrect(optionIndex)}
                    aria-label={t("options.markCorrect", { number: optionIndex + 1 })}
                    className="accent-success size-4"
                  />
                </label>
              )}
            />
            <div className="min-w-0 flex-1">
              <Input
                aria-label={t("options.label", { number: optionIndex + 1 })}
                placeholder={t("options.placeholder", { number: optionIndex + 1 })}
                maxLength={QUIZ_LIMITS.optionText}
                error={errorText(questionErrors?.options?.[optionIndex]?.text?.message)}
                {...register(`questions.${index}.options.${optionIndex}.text`)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canRemoveOption(options.fields.length)}
              onClick={() => removeOption(optionIndex)}
              aria-label={t("options.remove", { number: optionIndex + 1 })}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        {optionsError && (
          <p role="alert" className="text-danger text-sm">
            {optionsError}
          </p>
        )}
        <p className="text-muted text-xs">{t("options.hint")}</p>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={!canAddOption(options.fields.length)}
          onClick={() => options.append({ text: "", isCorrect: false })}
        >
          <Plus className="size-4" aria-hidden />
          {t("options.add")}
        </Button>
      </fieldset>
    </Card>
  );
}
