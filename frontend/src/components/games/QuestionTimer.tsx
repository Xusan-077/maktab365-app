"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

/** Oxirgi shuncha soniyada taymer qizil. */
export const TIMER_WARNING_SECONDS = 5;

export const formatClock = (seconds: number) => {
  const whole = Math.ceil(Math.max(0, seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};

/** Kamayadigan chiziq + `mm:ss`; oxirgi 5 soniyada qizil. Hisob `useCountdown` da. */
export function QuestionTimer({ remaining, total }: { remaining: number; total: number }) {
  const t = useTranslations("games.play");
  const warning = remaining <= TIMER_WARNING_SECONDS;
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <div
      className="flex items-center gap-3"
      data-testid="question-timer"
      data-warning={warning || undefined}
    >
      <div
        role="progressbar"
        aria-label={t("timerLabel")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.ceil(remaining)}
        aria-valuetext={formatClock(remaining)}
        className="bg-subtle h-3.5 flex-1 overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full origin-left rounded-full transition-[transform,background-color] duration-200 ease-linear",
            warning ? "bg-team-red" : "bg-[var(--game-from,var(--color-game-indigo))]",
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <span
        aria-hidden
        className={cn(
          "inline-flex min-w-[5.5rem] items-center justify-end gap-1.5 text-2xl font-extrabold tabular-nums sm:text-3xl",
          warning ? "text-danger motion-safe:animate-pulse" : "text-foreground",
        )}
      >
        <Timer className="size-6" aria-hidden />
        {formatClock(remaining)}
      </span>
    </div>
  );
}
