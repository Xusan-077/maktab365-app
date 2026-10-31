"use client";

import type { ReactNode } from "react";
import { Check, Clock, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { GameQuestion } from "@/lib/games/api";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { AnswerOption } from "./AnswerOption";
import type { RoundOutcome, useQuestionRound } from "./useQuestionRound";

const SPARK_COUNT = 18;
const SPARK_COLORS = [
  "var(--color-game-box)",
  "var(--color-game-gold)",
  "var(--color-team-green)",
  "var(--color-game-sector-2)",
  "var(--color-team-red)",
];

/** Markazdan tarqaladigan uchqunlar (bezak; `prefers-reduced-motion` da ko'rinmaydi). */
export function Sparks() {
  return (
    <span
      aria-hidden
      className="game-sparks pointer-events-none absolute top-1/2 left-1/2 z-20"
      data-testid="sparks"
    >
      {Array.from({ length: SPARK_COUNT }, (_, index) => {
        const angle = (index / SPARK_COUNT) * Math.PI * 2;
        const radius = 160 + (index % 3) * 60;
        return (
          <span
            key={index}
            className="absolute -mt-1.5 -ml-1.5 block size-3 rounded-full"
            style={
              {
                backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length],
                "--dx": `${Math.round(Math.cos(angle) * radius)}px`,
                "--dy": `${Math.round(Math.sin(angle) * radius)}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/** Javobdan keyingi tekis panel. `children` — oq "Davom etish"/"Keyingi" tugmasi. */
export function AnswerFeedback({
  outcome,
  question,
  correctIndex,
  points = 1,
  short = false,
  children,
  className,
}: {
  outcome: RoundOutcome;
  question: GameQuestion;
  correctIndex: number;
  points?: number;
  /** Tor panel: qisqa matn va kichik belgi. */
  short?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  const correct = outcome.kind === "answered" && outcome.correct;
  const Icon = correct ? Check : outcome.kind === "timeout" ? Clock : X;
  const answer = question.options[correctIndex];

  return (
    <div
      className={cn(
        "game-anim-up flex items-center justify-between gap-3 rounded-[18px] font-bold text-white",
        short ? "px-3.5 py-2.5 text-sm" : "px-5 py-3.5 text-[clamp(18px,2vw,24px)]",
        correct ? "bg-game-ok-ink" : "bg-game-err-dark",
        className,
      )}
      data-testid="game-feedback"
    >
      <p className="flex min-w-0 items-center gap-3" role="status" data-testid="game-outcome">
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-white/20",
            short ? "size-8" : "size-10",
          )}
        >
          <Icon className={short ? "size-[18px]" : "size-[22px]"} strokeWidth={3} />
        </span>
        <span>
          {outcome.kind === "timeout"
            ? t("timeUp")
            : correct
              ? t("correctPoints", { points })
              : answer
                ? t(short ? "wrongShort" : "wrongAnswer", {
                    answer: getLocalized(answer.text, locale),
                  })
                : t("wrong")}
        </span>
      </p>
      {children}
    </div>
  );
}

/** Variantlar: `large` — 2 ustun (mobilda 1), aks holda ustma-ust. */
export function OptionGrid({
  question,
  round,
  large,
  className,
}: {
  question: GameQuestion;
  round: ReturnType<typeof useQuestionRound>;
  large?: boolean;
  className?: string;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  return (
    <div
      className={cn("grid", large ? "gap-3.5 min-[721px]:grid-cols-2" : "gap-2.5", className)}
      role="group"
      aria-label={t("answersLabel")}
    >
      {question.options.map((option, index) => (
        <AnswerOption
          key={option.id}
          index={index}
          large={large}
          text={getLocalized(option.text, locale)}
          state={round.stateOf(option.id)}
          disabled={round.locked}
          onSelect={() => void round.choose(index)}
        />
      ))}
    </div>
  );
}

const buttonBase =
  "game-press focus-visible:ring-game-indigo/50 inline-flex items-center justify-center gap-2 font-extrabold focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60";

/** Asosiy tugma (o'yin rangida, pastki chiziq bilan). */
export const primaryButton = cn(
  buttonBase,
  "h-[58px] rounded-[18px] bg-[var(--game,var(--color-game-indigo))] px-7 text-lg text-white [--press-deep:var(--game-deep,var(--color-game-indigo-deep))]",
);
/** Oq fonli ikkinchi darajali tugma. */
export const ghostButton = cn(
  buttonBase,
  "border-border bg-surface text-foreground h-[58px] rounded-[18px] border-2 px-7 text-lg [--press-deep:var(--color-border)] [--press-depth:4px]",
);
/** Javob panelidagi oq tugma (soyasiz). */
export const whiteButton =
  "focus-visible:ring-white/60 text-game-boot inline-flex h-[46px] items-center justify-center rounded-[14px] bg-white px-5 text-[15px] font-extrabold focus-visible:ring-4 focus-visible:outline-none";
