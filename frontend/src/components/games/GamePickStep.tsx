"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "@/components/ui/motion";
import { GAME_IDS, GAME_KEYS, type GameId } from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";
import { GameIcon } from "./GameIcon";

/** Modalning 1-qadami: 3 ta katta o'yin kartasi (bittasi tanlanadi). */
export function GamePickStep({
  selected,
  onSelect,
}: {
  selected: GameId | null;
  onSelect: (game: GameId) => void;
}) {
  const t = useTranslations("games");

  return (
    <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4" data-testid="game-pick">
      {GAME_IDS.map((game, index) => {
        const key = GAME_KEYS[game];
        const active = selected === game;
        return (
          <li key={game} data-game={key}>
            <button
              type="button"
              aria-pressed={active}
              autoFocus={index === 0 && selected === null}
              onClick={() => onSelect(game)}
              data-testid={`game-option-${game}`}
              className={cn(
                "bg-surface relative flex h-full w-full items-center gap-4 rounded-[1.5rem] border-[3px] p-4 text-left transition-[border-color,box-shadow,transform] sm:flex-col sm:items-start sm:gap-3 sm:p-5",
                "focus-visible:ring-game-indigo/50 focus-visible:ring-4 focus-visible:outline-none",
                active
                  ? "border-[var(--game-from)] shadow-[0_14px_30px_-14px_var(--game-deep)]"
                  : "border-border hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--game-from)_45%,var(--color-border))] motion-reduce:hover:translate-y-0",
              )}
            >
              <GameIcon game={game} size="lg" float />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-foreground text-lg leading-tight font-extrabold">
                  {t(`list.${key}.name`)}
                </span>
                <span className="bg-subtle text-foreground w-fit rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {t(`list.${key}.tag`)}
                </span>
                <span className="text-muted text-sm leading-snug">
                  {t(`list.${key}.description`)}
                </span>
              </span>
              <AnimatePresence>
                {active && (
                  <m.span
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      transition: { type: "spring", stiffness: 520, damping: 22 },
                    }}
                    exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
                    className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-[var(--game-from)] text-white shadow-md"
                  >
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                    <span className="sr-only">{t("modal.selected")}</span>
                  </m.span>
                )}
              </AnimatePresence>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
