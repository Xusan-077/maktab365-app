"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnswerSheet } from "@/lib/books/api";
import {
  choiceLetters,
  nextQuestionOnPage,
  questionKey,
  questionsOnPage,
  type SheetProgress,
} from "@/lib/books/test-mode";
import { cn } from "@/lib/utils/cn";
import { BK_ICON_BUTTON } from "../reader-styles";
import { AnswerChoices } from "./AnswerChoices";

export interface QuickAnswerBarProps {
  sheet: AnswerSheet;
  page: number;
  answers: ReadonlyMap<string, string>;
  progress: SheetProgress;
  /** Yon daftar yopiq/ochiq: javoblar varag'ini ochadi. */
  onOpenSheet: () => void;
  onAnswer: (page: number, question: number, answer: string) => void;
}

function Bar({ sheet, page, answers, progress, onOpenSheet, onAnswer }: QuickAnswerBarProps) {
  const t = useTranslations("books.test");
  const questions = questionsOnPage(sheet, page);
  const firstOpen = questions.findIndex((q) => !answers.has(questionKey(q.page, q.question)));
  const [index, setIndex] = useState(Math.max(firstOpen, 0));
  const letters = choiceLetters(sheet.choices);
  const current = questions[Math.min(index, questions.length - 1)];
  if (!current) return null;
  const position = questions.indexOf(current);
  const value = answers.get(questionKey(current.page, current.question));

  return (
    <div
      data-quick-answer
      className={cn(
        "pointer-events-none absolute inset-x-0 top-[4.5rem] z-20 flex justify-center px-2",
      )}
    >
      <div
        role="group"
        aria-label={t("quick.label", { page })}
        className="bg-bk-bar/95 border-bk-line text-bk-ink pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border p-1 shadow-[0_8px_30px_-8px_rgb(0_0_0/0.35)] backdrop-blur max-sm:gap-0.5"
      >
        <button
          type="button"
          className={cn(BK_ICON_BUTTON, "max-sm:size-8")}
          disabled={position === 0}
          onClick={() => setIndex(position - 1)}
          aria-label={t("quick.previous")}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span
          className="min-w-5 text-center text-sm font-semibold tabular-nums sm:min-w-7"
          aria-live="polite"
        >
          <span className="sr-only">{t("quick.question")} </span>
          {current.question}
          <span className="text-bk-muted font-normal max-sm:hidden">/{questions.length}</span>
        </span>
        <AnswerChoices
          key={`${current.page}:${current.question}`}
          question={current.question}
          kind={current.kind}
          letters={letters}
          value={value}
          onChange={(answer) => {
            onAnswer(current.page, current.question, answer);
            if (answer) setIndex(nextQuestionOnPage(questions, answers, position));
          }}
          dense
          className="max-sm:gap-0.5"
        />
        <button
          type="button"
          className={cn(BK_ICON_BUTTON, "max-sm:size-8")}
          disabled={position === questions.length - 1}
          onClick={() => setIndex(position + 1)}
          aria-label={t("quick.next")}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onOpenSheet}
          aria-label={t("quick.openSheet", {
            answered: progress.answered,
            total: progress.total,
          })}
          title={t("quick.openSheet", { answered: progress.answered, total: progress.total })}
          className="text-bk-accent hover:bg-bk-accent-soft inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-1 text-sm font-medium sm:gap-1.5 sm:px-2"
        >
          <ListChecks className="size-5" aria-hidden />
          <span className="tabular-nums">
            {progress.answered}/{progress.total}
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Test kitob: betdagi savollarga tez javob paneli. Javob bosilganda keyingi javobsiz savolga o'tadi.
 * Bet almashsa panel qayta quriladi (birinchi javobsiz savoldan boshlanadi).
 */
export function QuickAnswerBar(props: QuickAnswerBarProps) {
  if (questionsOnPage(props.sheet, props.page).length === 0) return null;
  return <Bar key={props.page} {...props} />;
}
