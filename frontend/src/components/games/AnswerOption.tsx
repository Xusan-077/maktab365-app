"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "dim";

/**
 * Javob varianti: A/B/C/D doirasi va matn, 6px pastki chegara; holatlar `.game-opt` da
 * (`data-state`). Klaviatura yorliqlari `useQuestionRound` da.
 */
export function AnswerOption({
  index,
  text,
  state,
  disabled,
  large,
  onSelect,
}: {
  index: number;
  text: string;
  state: AnswerState;
  disabled?: boolean;
  /** Quti modali (proyektor uchun yirik). */
  large?: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("games.play");
  const letter = OPTION_LETTERS[index];

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={t("option", { letter, text })}
      aria-pressed={
        state === "selected" || state === "correct" || state === "wrong" ? true : undefined
      }
      data-state={state}
      data-testid="answer-option"
      className={cn(
        "game-opt focus-visible:ring-game-indigo/50 flex w-full items-center rounded-[18px] text-left font-bold focus-visible:ring-4 focus-visible:outline-none disabled:cursor-default",
        large
          ? "min-h-[84px] gap-4 px-5 py-2 text-[clamp(20px,2.4vw,30px)] leading-tight"
          : "min-h-[58px] gap-3 px-3.5 py-2 text-base leading-snug",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "bg-subtle text-foreground flex shrink-0 items-center justify-center rounded-full font-extrabold",
          large ? "size-[46px] text-xl" : "size-9 text-[15px]",
        )}
      >
        {letter}
      </span>
      <span className="min-w-0">{text}</span>
    </button>
  );
}
