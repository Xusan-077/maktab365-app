"use client";

import type { ReactNode } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { m } from "@/components/ui/motion";
import { formatClock, percentOf, type ReviewItem } from "@/lib/quizzes/play";

interface Props {
  score: number;
  total: number;
  timeSpent: number;
  review: ReviewItem[];
  onReplay: () => void;
  /** Saqlash holati, "Testlarga qaytish" kabi qo'shimcha bloklar. */
  children?: ReactNode;
}

function ReviewList({ items, wrong }: { items: ReviewItem[]; wrong: boolean }) {
  const t = useTranslations("quizzes.result");
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.questionId}>
          <Card className="flex flex-col gap-1 p-4">
            <p className="font-semibold break-words">{item.question}</p>
            {wrong && (
              <p className="text-danger flex items-start gap-1.5 text-sm">
                <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {t("yourAnswer")}: {item.chosenText ?? t("noAnswer")}
                </span>
              </p>
            )}
            <p className="text-success flex items-start gap-1.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {t("correctAnswer")}: {item.correctText}
              </span>
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Natija ekrani: ball, vaqt, xatolar ro'yxati va to'g'ri javoblar. */
export function QuizResult({ score, total, timeSpent, review, onReplay, children }: Props) {
  const t = useTranslations("quizzes.result");
  const percent = percentOf(score, total);
  const mistakes = review.filter((item) => !item.correct);
  const right = review.filter((item) => item.correct);

  return (
    <div className="flex flex-col gap-6" data-testid="quiz-result">
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="border-border bg-surface flex flex-col items-center gap-1 rounded-2xl border p-6 text-center shadow-sm"
      >
        <p className="text-muted text-sm font-medium">{t("yourScore")}</p>
        <p className="text-5xl font-extrabold tabular-nums">
          {score} <span className="text-muted text-3xl">/ {total}</span>
        </p>
        <p className="text-link text-xl font-bold">{percent}%</p>
        <p className="text-muted text-sm">{t("time", { time: formatClock(timeSpent) })}</p>
        <p className="mt-2 font-medium">
          {t(`message.${percent >= 80 ? "great" : percent >= 50 ? "good" : "retry"}`)}
        </p>
      </m.div>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={onReplay}>
          <RotateCcw className="size-4" aria-hidden />
          {t("replay")}
        </Button>
        {children}
      </div>

      {mistakes.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="mistakes-heading">
          <h2 id="mistakes-heading" className="text-lg font-semibold">
            {t("mistakes", { count: mistakes.length })}
          </h2>
          <ReviewList items={mistakes} wrong />
        </section>
      )}
      {right.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-lg font-semibold">
            {t("correctList", { count: right.length })}
          </summary>
          <div className="mt-3">
            <ReviewList items={right} wrong={false} />
          </div>
        </details>
      )}
    </div>
  );
}
