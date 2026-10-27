"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "dim";

const STATE: Record<AnswerState, string> = {
  idle: "border-border bg-surface text-foreground [--press-deep:var(--color-border)] hover:border-[var(--game-from,var(--color-game-indigo))]",
  selected:
    "border-[var(--game-from,var(--color-game-indigo))] bg-surface text-foreground [--press-deep:var(--game-deep,var(--color-game-indigo-deep))]",
  // To'q fon: oq matn kontrasti ≥ 4.5:1 (och `team-green`/`team-red` da yetmaydi).
  correct:
    "border-team-green-deep bg-team-green-deep text-white [--press-deep:color-mix(in_srgb,var(--color-team-green-deep)_70%,black)]",
  wrong:
    "border-team-red-deep bg-team-red-deep text-white [--press-deep:color-mix(in_srgb,var(--color-team-red-deep)_70%,black)]",
  dim: "border-border bg-surface text-foreground opacity-50 [--press-deep:var(--color-border)]",
};

/**
 * Javob varianti: A/B/C/D doirasi, katta matn, pastki chiziqli tugma (proyektor uchun yirik).
 * Klaviatura yorliqlari (1–4, A–D) `GamePlayView` da.
 */
export function AnswerOption({
  index,
  text,
  state,
  disabled,
  onSelect,
}: {
  index: number;
  text: string;
  state: AnswerState;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("games.play");
  const letter = OPTION_LETTERS[index];
  const marked = state === "correct" || state === "wrong";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={t("option", { letter, text })}
      aria-pressed={state === "selected" || marked ? true : undefined}
      data-state={state}
      data-testid="answer-option"
      className={cn(
        "game-press flex min-h-20 w-full items-center gap-4 rounded-[1.5rem] border-[3px] px-4 py-3 text-left transition-[border-color,background-color,opacity] sm:min-h-24 sm:px-5",
        "focus-visible:ring-game-indigo/50 focus-visible:ring-4 focus-visible:outline-none disabled:cursor-default",
        STATE[state],
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full text-xl font-extrabold sm:size-14 sm:text-2xl",
          marked
            ? "bg-white/25 text-white"
            : "bg-[var(--game-from,var(--color-game-indigo))] text-white",
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
      <span className="text-[clamp(1.125rem,0.9rem+1vw,1.75rem)] leading-snug font-bold">
        {text}
      </span>
    </button>
  );
}
