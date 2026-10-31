"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { TIME_PER_QUESTION } from "@/lib/quizzes/types";
import type { QuizFormValues } from "@/lib/validation/quiz";

/** Sozlamalar: taymer, aralashtirish, ochiq/shaxsiy. */
export function QuizSettingsFields() {
  const t = useTranslations("quizzes.form.settings");
  const { control, watch } = useFormContext<QuizFormValues>();
  const visibility = watch("visibility");

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>

      <Controller
        control={control}
        name="timePerQuestion"
        render={({ field }) => (
          <SegmentedControl
            legend={t("timer")}
            value={String(field.value)}
            onChange={(value) => field.onChange(Number(value))}
            options={[
              { value: "0", label: t("timerOff") },
              ...TIME_PER_QUESTION.map((seconds) => ({
                value: String(seconds),
                label: t("seconds", { seconds }),
              })),
            ]}
          />
        )}
      />

      <Controller
        control={control}
        name="shuffleQuestions"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            label={t("shuffleQuestions")}
            description={t("shuffleQuestionsHint")}
          />
        )}
      />
      <Controller
        control={control}
        name="shuffleOptions"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            label={t("shuffleOptions")}
            description={t("shuffleOptionsHint")}
          />
        )}
      />

      <Controller
        control={control}
        name="visibility"
        render={({ field }) => (
          <SegmentedControl
            legend={t("visibility")}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "private", label: t("private") },
              { value: "public", label: t("public") },
            ]}
          />
        )}
      />
      <p className="text-muted text-sm">
        {t(visibility === "public" ? "publicHint" : "privateHint")}
      </p>
    </Card>
  );
}
