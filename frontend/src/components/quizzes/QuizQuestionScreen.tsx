"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "@/components/ui/motion";
import { cn } from "@/lib/utils/cn";
import type { Pick, PlayQuestion } from "@/lib/quizzes/play";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface Props {
  question: PlayQuestion;
  /** Javob berilgach to'ldiriladi: to'g'ri/noto'g'ri ko'rsatiladi. */
  pick: Pick | null;
  disabled: boolean;
  onAnswer: (optionId: string) => void;
}

function optionState(pick: Pick | null, optionId: string): "idle" | "correct" | "wrong" | "dim" {
  if (!pick) return "idle";
  if (optionId === pick.correctOptionId) return "correct";
  if (optionId === pick.optionId) return "wrong";
  return "dim";
}

const STATE_CLASS = {
  idle: "border-border bg-surface hover:border-primary-300 hover:bg-subtle",
  correct: "border-success bg-success-soft text-success-soft-foreground",
  wrong: "border-danger bg-danger-soft text-danger-soft-foreground",
  dim: "border-border bg-surface opacity-60",
} as const;

/** Savol matni, rasm va variantlar; javobdan keyin to'g'ri/noto'g'ri animatsiya bilan bo'yaladi. */
export function QuizQuestionScreen({ question, pick, disabled, onAnswer }: Props) {
  const t = useTranslations("quizzes.play");

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold text-balance break-words sm:text-2xl">{question.text}</h2>
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- ommaviy saqlash manzili
        <img
          src={question.imageUrl}
          alt=""
          className="border-border max-h-64 w-auto max-w-full self-start rounded-xl border object-contain"
        />
      )}

      <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("options")}>
        {question.options.map((option, index) => {
          const state = optionState(pick, option.id);
          return (
            <li key={option.id}>
              <m.button
                type="button"
                disabled={disabled || pick !== null}
                onClick={() => onAnswer(option.id)}
                animate={
                  state === "wrong"
                    ? { x: [0, -8, 8, -6, 6, 0] }
                    : state === "correct"
                      ? { scale: [1, 1.03, 1] }
                      : { x: 0, scale: 1 }
                }
                transition={{ duration: 0.4 }}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors disabled:cursor-default",
                  STATE_CLASS[state],
                )}
              >
                <span
                  aria-hidden
                  className="bg-subtle text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                >
                  {state === "correct" ? (
                    <Check className="text-success size-5" />
                  ) : state === "wrong" ? (
                    <X className="text-danger size-5" />
                  ) : (
                    LETTERS[index]
                  )}
                </span>
                <span className="min-w-0 break-words">{option.text}</span>
                {state === "correct" && <span className="sr-only">{t("correctMark")}</span>}
                {state === "wrong" && <span className="sr-only">{t("wrongMark")}</span>}
              </m.button>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="min-h-12">
        <AnimatePresence>
          {pick && (
            <m.p
              key="feedback"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-xl px-4 py-3 text-base font-semibold",
                pick.correct
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-danger-soft text-danger-soft-foreground",
              )}
            >
              {pick.correct ? t("correct") : pick.optionId === null ? t("timeUp") : t("wrong")}
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
