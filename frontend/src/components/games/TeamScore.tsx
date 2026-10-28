"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "@/components/ui/motion";
import type { TeamColor } from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";

/** Ball o'zgarishi: `id` har safar yangi (bir xil ball qayta qo'shilsa ham animatsiya). */
export interface ScoreGain {
  id: number;
  points: number;
}

let gainCounter = 0;
/** `ScoreGain.id` uchun (hodisa ishlovchilarida). */
export const nextGainId = () => ++gainCounter;

/**
 * Ball raqami: o'zgarganda sakraydi, yonidan "+1" (yashil) yoki "−1" (qizil) yuqoriga uchib
 * yo'qoladi. Ekran o'quvchisi uchun matn `TeamScore`/sahnada.
 */
export function ScoreNumber({
  score,
  gain,
  className,
}: {
  score: number;
  gain?: ScoreGain | null;
  className?: string;
}) {
  const t = useTranslations("games.play");
  return (
    <span aria-hidden className="relative inline-flex">
      <m.span
        key={score}
        initial={{ scale: gain ? 1.45 : 1 }}
        animate={{ scale: 1, transition: { type: "spring", stiffness: 500, damping: 14 } }}
        className={cn("inline-block font-extrabold tabular-nums", className)}
        data-testid="team-score-value"
      >
        {score}
      </m.span>
      <AnimatePresence>
        {gain && gain.points !== 0 && (
          <m.span
            key={gain.id}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -52, transition: { duration: 1.1, ease: "easeOut" } }}
            className={cn(
              "absolute right-0 bottom-[85%] text-2xl font-extrabold whitespace-nowrap",
              gain.points > 0
                ? "text-team-green-deep dark:text-team-green"
                : "text-team-red-deep dark:text-team-red",
            )}
          >
            {gain.points > 0
              ? t("points", { points: gain.points })
              : t("minusPoints", { points: -gain.points })}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * Jamoa kartasi: rang nuqtasi, nom, katta ball va "Navbat" belgisi. Faol kartaning chegarasi va
 * soyasi jamoa rangida (silliq o'tadi).
 */
export function TeamScore({
  name,
  color,
  score,
  active,
  gain,
  className,
}: {
  name: string;
  color: TeamColor;
  score: number;
  active: boolean;
  gain?: ScoreGain | null;
  className?: string;
}) {
  const t = useTranslations("games.play");
  return (
    <div
      data-team={color}
      data-active={active || undefined}
      data-testid="team-score"
      className={cn(
        "relative flex min-w-0 flex-1 items-center gap-1.5 rounded-[1.25rem] border-[3px] px-2.5 py-2.5 transition-[border-color,box-shadow,background-color] duration-300 sm:gap-3 sm:px-4 sm:py-3",
        active
          ? "border-[var(--team)] bg-[color-mix(in_srgb,var(--team)_12%,var(--color-surface))] shadow-[0_10px_26px_-12px_var(--team)]"
          : "border-border bg-surface",
        className,
      )}
    >
      <span aria-hidden className="size-3 shrink-0 rounded-full bg-[var(--team)] sm:size-4" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground line-clamp-2 text-sm leading-tight font-bold break-words sm:text-lg">
          {name}
        </span>
        {active && (
          <span className="text-xs font-extrabold tracking-wide text-[var(--team-deep)] uppercase sm:text-sm dark:text-[var(--team)]">
            {t("turnBadge")}
          </span>
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {t("score", { team: name, score })}
      </span>
      <ScoreNumber score={score} gain={gain} className="text-2xl sm:text-5xl" />
    </div>
  );
}
