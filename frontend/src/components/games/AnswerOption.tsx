"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TargetAndTransition } from "framer-motion";
import { m } from "@/components/ui/motion";
import { cn } from "@/lib/utils/cn";

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "dim";

const STATE: Record<AnswerState, string> = {
  idle: "border-border bg-surface text-foreground [--press-deep:var(--color-border)] hover:border-[var(--game-from,var(--color-game-indigo))]",
  selected:
    "border-[var(--game-from,var(--color-game-indigo))] bg-surface text-foreground [--press-deep:var(--game-deep,var(--color-game-indigo-deep))]",
  correct:
    "border-team-green bg-game-ok-soft text-foreground [--press-deep:var(--color-team-green-deep)]",
  wrong:
    "border-team-red bg-game-bad-soft text-foreground [--press-deep:var(--color-team-red-deep)]",
  dim: "border-border bg-surface text-foreground opacity-50 [--press-deep:var(--color-border)]",
};

/** To'g'ri — pop (1 → 1.07 → 1), xato — silkinish (±10px). `MotionConfig` reduced-motion'da o'chiradi. */
const MOTION: Partial<Record<AnswerState, TargetAndTransition>> = {
  correct: { scale: [1, 1.07, 1], transition: { duration: 0.42, ease: "easeOut" } },
  wrong: { x: [0, -10, 10, -10, 10, -5, 0], transition: { duration: 0.45 } },
};

/**
 * Javob varianti: A/B/C/D doirasi, katta matn, pastki chiziqli tugma (proyektor uchun yirik).
 * Klaviatura yorliqlari (1–4, A–D) `useQuestionRound` da.
 */
export function AnswerOption({
  index,
  text,
  state,
  disabled,
  compact,
  onSelect,
}: {
  index: number;
  text: string;
  state: AnswerState;
  disabled?: boolean;
  /** Tor panel (arqon tortish): pastroq balandlik va kichikroq doira. */
  compact?: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("games.play");
  const letter = OPTION_LETTERS[index];
  const marked = state === "correct" || state === "wrong";

  return (
    <m.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={t("option", { letter, text })}
      aria-pressed={state === "selected" || marked ? true : undefined}
      data-state={state}
      data-testid="answer-option"
      animate={MOTION[state] ?? { scale: 1, x: 0 }}
      className={cn(
        "game-press flex w-full items-center gap-4 rounded-[1.5rem] border-[3px] px-4 py-3 text-left transition-[border-color,background-color,opacity]",
        compact ? "min-h-16 sm:min-h-[4.5rem]" : "min-h-20 sm:min-h-24 sm:px-5",
        "focus-visible:ring-game-indigo/50 focus-visible:ring-4 focus-visible:outline-none disabled:cursor-default",
        STATE[state],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-extrabold text-white",
          compact
            ? "size-10 text-lg sm:size-12 sm:text-xl"
            : "size-12 text-xl sm:size-14 sm:text-2xl",
          state === "correct"
            ? "bg-team-green-deep"
            : state === "wrong"
              ? "bg-team-red-deep"
              : "bg-[var(--game-from,var(--color-game-indigo))]",
        )}
      >
        {state === "correct" ? (
          <Check className="size-7" strokeWidth={3} />
        ) : state === "wrong" ? (
          <X className="size-7" strokeWidth={3} />
        ) : (
          letter
        )}
      </span>
      <span
        className={cn(
          "leading-snug font-bold",
          compact
            ? "text-[clamp(1rem,0.85rem+0.6vw,1.375rem)]"
            : "text-[clamp(1.125rem,0.9rem+1vw,1.75rem)]",
        )}
      >
        {text}
      </span>
    </m.button>
  );
}
