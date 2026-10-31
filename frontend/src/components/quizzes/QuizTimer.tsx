"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils/cn";

interface Props {
  seconds: number;
  running: boolean;
  onExpire: () => void;
}

/** Savol taymeri. Har savolga alohida montaj qilinadi (`key={question.id}`), shuning uchun qayta boshlanadi. */
export function QuizTimer({ seconds, running, onExpire }: Props) {
  const t = useTranslations("quizzes.play");
  const remaining = useCountdown(seconds, running, onExpire);
  const left = Math.ceil(remaining);
  const low = remaining <= 5;

  return (
    <div
      className="flex items-center gap-3"
      role="timer"
      aria-label={t("timeLeft", { seconds: left })}
    >
      <Timer className={cn("size-4 shrink-0", low ? "text-danger" : "text-muted")} aria-hidden />
      <div className="bg-subtle h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            low ? "bg-danger" : "bg-primary-600",
          )}
          style={{ width: `${Math.min(100, (remaining / seconds) * 100)}%` }}
        />
      </div>
      <span
        className={cn("w-8 text-right text-sm font-semibold tabular-nums", low && "text-danger")}
      >
        {left}
      </span>
    </div>
  );
}
