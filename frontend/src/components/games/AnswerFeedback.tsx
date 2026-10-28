"use client";

import { useState, type ReactNode } from "react";
import { Check, Clock, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import type { GameQuestion } from "@/lib/games/api";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { AnswerOption, OPTION_LETTERS } from "./AnswerOption";
import type { RoundOutcome, useQuestionRound } from "./useQuestionRound";

const SPARK_COLORS = [
  "var(--color-team-green)",
  "var(--color-game-sun)",
  "var(--color-team-blue)",
  "var(--color-game-wheel-from)",
  "var(--color-team-red)",
  "var(--color-game-box-to)",
];

/** Markazdan tarqaladigan rangli uchqunlar (bezak). */
export function Sparks({ count = 14 }: { count?: number }) {
  const [sparks] = useState(() =>
    Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 46 + Math.random() * 40;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 6 + Math.random() * 6,
        color: SPARK_COLORS[index % SPARK_COLORS.length],
      };
    }),
  );
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {sparks.map((spark, index) => (
        <m.span
          key={index}
          className="absolute top-1/2 left-1/2 block rounded-full"
          style={{
            width: spark.size,
            height: spark.size,
            marginLeft: -spark.size / 2,
            marginTop: -spark.size / 2,
            backgroundColor: spark.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
          animate={{
            x: spark.x,
            y: spark.y,
            opacity: 0,
            scale: 1,
            transition: { duration: 0.75, ease: "easeOut" },
          }}
        />
      ))}
    </span>
  );
}

/**
 * Javobdan keyingi panel: pastdan siljib chiqadi, belgili doira pop qiladi (to'g'rida uchqunlar).
 * `children` — "Davom etish"/"Keyingi" tugmasi.
 */
export function AnswerFeedback({
  outcome,
  correctIndex,
  extra,
  children,
  className,
}: {
  outcome: RoundOutcome;
  correctIndex: number;
  /** Masalan, "+2 ball". */
  extra?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("games.play");
  const correct = outcome.kind === "answered" && outcome.correct;
  const Icon = correct ? Check : outcome.kind === "timeout" ? Clock : X;
  const letter = !correct && correctIndex >= 0 ? OPTION_LETTERS[correctIndex] : null;

  return (
    <m.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 30 } }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-[1.5rem] border-[3px] px-4 py-3 sm:flex-row sm:gap-4 sm:px-5",
        correct ? "border-team-green bg-game-ok-soft" : "border-team-red bg-game-bad-soft",
        className,
      )}
      data-testid="game-feedback"
    >
      <span className="relative flex size-14 shrink-0 items-center justify-center">
        {correct && <Sparks />}
        <m.span
          initial={{ scale: 0 }}
          animate={{ scale: 1, transition: { type: "spring", stiffness: 520, damping: 14 } }}
          className={cn(
            "flex size-14 items-center justify-center rounded-full text-white",
            correct ? "bg-team-green-deep" : "bg-team-red-deep",
          )}
        >
          <Icon className="size-8" strokeWidth={3} aria-hidden />
        </m.span>
      </span>
      <p
        className="text-foreground flex-1 text-center text-2xl font-extrabold sm:text-left sm:text-3xl"
        data-testid="game-outcome"
        role="status"
      >
        {outcome.kind === "timeout" ? t("timeUp") : correct ? t("correct") : t("wrong")}
        {letter && (
          <span className="text-muted mt-0.5 block text-base font-bold sm:text-lg">
            {t("correctAnswer", { letter })}
          </span>
        )}
        {extra}
      </p>
      {children}
    </m.div>
  );
}

/** 2×2 variantlar to'ri (mobilda bir ustun). */
export function OptionGrid({
  question,
  round,
  compact,
  className,
}: {
  question: GameQuestion;
  round: ReturnType<typeof useQuestionRound>;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  return (
    <div
      className={cn("grid gap-3", !compact && "sm:grid-cols-2 sm:gap-4", className)}
      role="group"
      aria-label={t("answersLabel")}
    >
      {question.options.map((option, index) => (
        <AnswerOption
          key={option.id}
          index={index}
          compact={compact}
          text={getLocalized(option.text, locale)}
          state={round.stateOf(option.id)}
          disabled={round.locked}
          onSelect={() => void round.choose(index)}
        />
      ))}
    </div>
  );
}

/** Asosiy harakat tugmasi (o'yin rangida, pastki chiziq bilan). */
export const primaryButton =
  "game-press focus-visible:ring-game-indigo/50 inline-flex h-14 min-w-44 items-center justify-center gap-2 rounded-[1.125rem] bg-[var(--game-from)] px-6 text-lg font-extrabold text-white [--press-deep:var(--game-deep)] focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60";
