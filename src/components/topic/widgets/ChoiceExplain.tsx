"use client";

import { useId, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Resolved } from "@/lib/i18n/localize-blocks";
import { cn } from "@/lib/utils/cn";
import type { ChoiceExplainProps } from "@/types/topic";
import { WidgetFrame } from "./WidgetFrame";

export function ChoiceExplain({ prompt, options }: Resolved<ChoiceExplainProps>) {
  const t = useTranslations("topic.choiceExplain");
  const uid = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const option = selected === null ? null : options[selected];

  return (
    <WidgetFrame title={t("title")} hint={t("hint")}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-3 text-lg font-medium">{prompt}</legend>
        {options.map((item, index) => (
          <label
            key={index}
            className="border-border bg-surface hover:bg-subtle has-[:checked]:border-primary-600 has-[:checked]:bg-primary-soft flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 transition-colors"
          >
            <input
              type="radio"
              name={`${uid}-option`}
              checked={selected === index}
              onChange={() => setSelected(index)}
              className="accent-primary-600 size-5 shrink-0"
            />
            <span>{item.text}</span>
          </label>
        ))}
      </fieldset>

      <div role="status" aria-live="polite" className="empty:hidden">
        {option && (
          <div
            className={cn(
              "rounded-lg px-4 py-3",
              option.correct
                ? "bg-success-soft text-success-soft-foreground"
                : "bg-danger-soft text-danger-soft-foreground",
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {option.correct ? (
                <CircleCheck className="size-5 shrink-0" aria-hidden />
              ) : (
                <CircleAlert className="size-5 shrink-0" aria-hidden />
              )}
              {option.correct ? t("correct") : t("incorrect")}
            </p>
            <p className="mt-1">
              <span className="font-medium">{t("reason")}:</span> {option.reason}
            </p>
          </div>
        )}
      </div>

      {selected !== null && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            {t("reset")}
          </Button>
        </div>
      )}
    </WidgetFrame>
  );
}
