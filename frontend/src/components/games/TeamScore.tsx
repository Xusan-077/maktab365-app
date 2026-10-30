"use client";

import { useTranslations } from "next-intl";
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
 * yo'qoladi. Ekran o'quvchisi uchun matn sahnada.
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
  const changed = gain && gain.points !== 0;
  return (
    <span aria-hidden className="relative inline-block">
      <span
        key={changed ? gain.id : "score"}
        className={cn(
          "inline-block font-extrabold tabular-nums",
          changed && "game-anim-bump",
          className,
          "leading-none",
        )}
        data-testid="team-score-value"
      >
        {score}
      </span>
      {changed && (
        <span
          key={gain.id}
          className={cn(
            "game-anim-gain pointer-events-none absolute top-0 -right-9 text-[26px] font-extrabold whitespace-nowrap",
            gain.points > 0 ? "text-game-ok-dark" : "text-game-err-dark",
          )}
        >
          {gain.points > 0
            ? t("points", { points: gain.points })
            : t("minusPoints", { points: -gain.points })}
        </span>
      )}
    </span>
  );
}

/** Jamoa kartasi (Omad charhi): nom, "Navbat" belgisi, katta ball; faoli jamoa rangida. */
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
        "bg-surface flex items-center justify-between gap-3 rounded-[22px] border-2 px-5 py-[18px] transition-[border-color,box-shadow] duration-300",
        active
          ? "border-[var(--team)] shadow-[0_5px_0_color-mix(in_srgb,var(--team)_35%,transparent)]"
          : "border-border shadow-[0_5px_0_var(--color-border)]",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold tracking-[0.3px] text-[var(--team)] uppercase">
          <i aria-hidden className="size-3 shrink-0 rounded-full bg-[var(--team)]" />
          <span className="min-w-0 break-words">{name}</span>
        </div>
        {active && (
          <span className="mt-2 inline-block rounded-full bg-[var(--game-soft)] px-2.5 py-[3px] text-xs font-bold text-[var(--game-ink)]">
            {t("turnBadge")}
          </span>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {t("score", { team: name, score })}
      </span>
      <ScoreNumber
        score={score}
        gain={gain}
        className="text-[32px] tracking-[-1px] sm:text-[44px]"
      />
    </div>
  );
}
