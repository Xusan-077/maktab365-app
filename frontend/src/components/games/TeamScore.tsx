"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "@/components/ui/motion";
import type { TeamColor } from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";

/**
 * Jamoa bali: rangli karta, navbatdagi jamoa ajralib turadi. Ball qo'shilganda "+N" yuqoriga
 * uchib ketadi va raqam sakraydi (`gain.id` har javobda yangi).
 */
export function TeamScore({
  name,
  color,
  score,
  active,
  gain,
}: {
  name: string;
  color: TeamColor;
  score: number;
  active: boolean;
  gain?: { id: number; points: number } | null;
}) {
  const t = useTranslations("games.play");
  return (
    <div
      data-team={color}
      data-active={active || undefined}
      data-testid="team-score"
      className={cn(
        "relative flex min-w-0 flex-1 items-center gap-2 rounded-[1.25rem] border-[3px] px-3 py-2.5 transition-[border-color,box-shadow,background-color] sm:gap-3 sm:px-4 sm:py-3",
        active
          ? "border-[var(--team)] bg-[color-mix(in_srgb,var(--team)_12%,var(--color-surface))] shadow-[0_8px_22px_-12px_var(--team)]"
          : "border-border bg-surface",
      )}
    >
      <span aria-hidden className="size-4 shrink-0 rounded-full bg-[var(--team)]" />
      <span className="text-foreground line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-bold break-words sm:text-lg">
        {name}
      </span>
      <span className="sr-only" aria-live="polite">
        {t("score", { team: name, score })}
      </span>
      <span aria-hidden className="relative">
        <m.span
          key={score}
          initial={{ scale: gain ? 1.45 : 1 }}
          animate={{ scale: 1, transition: { type: "spring", stiffness: 500, damping: 14 } }}
          className="inline-block text-3xl font-extrabold tabular-nums sm:text-4xl"
        >
          {score}
        </m.span>
        <AnimatePresence>
          {gain && gain.points > 0 && (
            <m.span
              key={gain.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -48, transition: { duration: 1.1, ease: "easeOut" } }}
              className="text-team-green-deep absolute -top-2 right-0 text-2xl font-extrabold dark:text-[var(--color-team-green)]"
            >
              {t("points", { points: gain.points })}
            </m.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}
