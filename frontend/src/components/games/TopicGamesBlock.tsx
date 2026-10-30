"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { GAME_IDS, GAME_KEYS, type GameId } from "@/lib/games/config";
import { gameQueries } from "@/lib/games/queries";
import { gameTopicSlug } from "@/lib/utils/routes";
import { GameIcon } from "./GameIcon";
import { GameStartModal } from "./GameStartModal";

/**
 * Mavzu sahifasidagi "Interaktiv o'yinlar" bloki: 3 o'yin kartasi.
 * Karta shu mavzu va o'yin bilan kirish modalini ochadi. Savollari yetmagan mavzuda — izoh.
 */
export function TopicGamesBlock({ chapterId }: { chapterId: string }) {
  const t = useTranslations("games");
  const topic = useQuery(gameQueries.topic(gameTopicSlug(chapterId)));
  const [game, setGame] = useState<GameId | null>(null);

  return (
    <section
      className="font-game flex flex-col gap-4"
      aria-labelledby="topic-games-title"
      data-testid="topic-games"
    >
      <div className="flex items-center gap-3">
        <span className="bg-game-indigo flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] text-white">
          <Gamepad2 className="size-6" aria-hidden />
        </span>
        <div>
          <h3 id="topic-games-title" className="text-ds-ink text-lg font-extrabold">
            {t("topicBlock.title")}
          </h3>
          <p className="text-ds-muted text-sm">{t("topicBlock.lead")}</p>
        </div>
      </div>

      {topic.isPending ? (
        <div className="flex flex-col gap-2.5">
          {GAME_IDS.map((id) => (
            <Skeleton key={id} className="h-20 rounded-[1.25rem]" />
          ))}
        </div>
      ) : topic.isError ? (
        <p className="text-ds-muted text-sm" role="alert">
          {t("topicBlock.error")}
        </p>
      ) : !topic.data ? (
        <p
          className="bg-ds-canvas text-ds-muted rounded-[1.25rem] px-4 py-3 text-sm"
          data-testid="topic-games-unavailable"
        >
          {t("topicBlock.unavailable")}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {GAME_IDS.map((id) => {
              const key = GAME_KEYS[id];
              return (
                <li key={id} data-game={key}>
                  <button
                    type="button"
                    onClick={() => setGame(id)}
                    className="border-ds-line bg-ds-surface focus-visible:ring-game-indigo/40 flex w-full items-center gap-3.5 rounded-[1.25rem] border-2 p-3 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--game-from)] focus-visible:ring-4 focus-visible:outline-none motion-reduce:hover:translate-y-0"
                  >
                    <GameIcon game={id} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-ds-ink font-extrabold">{t(`list.${key}.name`)}</span>
                      <span className="text-ds-muted text-sm">{t(`list.${key}.tag`)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <GameStartModal
            topic={game ? topic.data : null}
            initialGame={game}
            onClose={() => setGame(null)}
          />
        </>
      )}
    </section>
  );
}
