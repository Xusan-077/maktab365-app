"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils/cn";

/** Soniya → "m:ss" (yuqoriga yaxlitlanadi: 0:30 dan boshlanadi). */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** Oxirgi `below` soniyada har soniyada `beep`. */
export function useCountdownBeep(seconds: number, below: number, active: boolean) {
  const { play } = useSound();
  const whole = Math.ceil(seconds);
  useEffect(() => {
    if (active && whole > 0 && whole <= below) play("beep");
  }, [active, whole, below, play]);
}

/** Savol vaqti: 6px tekis chiziq, chapga qisqaradi. */
export function TimeBar({
  remaining,
  total,
  className,
}: {
  remaining: number;
  total: number;
  className?: string;
}) {
  const t = useTranslations("games.play");
  return (
    <div
      role="timer"
      aria-label={t("timerLabel")}
      data-testid="question-timer"
      className={cn("bg-game-gold h-1.5 transition-[width] duration-200 ease-linear", className)}
      style={{ width: `${Math.max(0, Math.min(1, remaining / total)) * 100}%` }}
    >
      <span className="sr-only">{formatClock(remaining)}</span>
    </div>
  );
}
