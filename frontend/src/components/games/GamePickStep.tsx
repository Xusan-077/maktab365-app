"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
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
    <ul className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-5" data-testid="game-pick">
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
                "bg-surface relative flex h-full w-full items-stretch overflow-hidden rounded-[24px] border-[3px] text-left transition-[transform,box-shadow,border-color] duration-[180ms] hover:-translate-y-1 motion-reduce:hover:translate-y-0 sm:flex-col",
                "focus-visible:ring-game-indigo/50 focus-visible:ring-4 focus-visible:outline-none",
                active
                  ? "border-[var(--game)] shadow-[0_5px_0_var(--game)]"
                  : "border-border shadow-[0_2px_0_var(--color-border)]",
              )}
            >
              <span className="flex w-24 flex-none items-center justify-center bg-[var(--game-soft)] sm:h-[150px] sm:w-auto">
                <GameIcon game={game} size="lg" float delay={index * 0.3} />
              </span>
              <span className="block min-w-0 flex-1 px-5 pt-[18px] pb-5">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground text-[22px] leading-tight font-extrabold">
                    {t(`list.${key}.name`)}
                  </span>
                  <span className="rounded-full bg-[var(--game-soft)] px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[var(--game-ink)]">
                    {t(`list.${key}.tag`)}
                  </span>
                </span>
                <span className="text-muted mt-2 hidden text-sm leading-[1.45] sm:block">
                  {t(`list.${key}.description`)}
                </span>
              </span>
              {active && (
                <span className="game-anim-pop-in absolute top-3.5 right-3.5 flex size-[34px] items-center justify-center rounded-full bg-[var(--game)] text-white [animation-duration:.3s]">
                  <Check className="size-[18px]" strokeWidth={3} aria-hidden />
                  <span className="sr-only">{t("modal.selected")}</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
