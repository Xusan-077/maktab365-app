"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { GAME_IDS, GAME_KEYS, type GameId } from "@/lib/games/config";
import { gameQueries } from "@/lib/games/queries";
import { gameTopicSlug } from "@/lib/utils/routes";
import { GameGlyph } from "./GameIcon";
import { GameStartModal } from "./GameStartModal";

/**
 * Mavzu sahifasidagi "Interaktiv o'yinlar" bloki: 3 o'yin kartasi (tor panelda qatorlar — container
 * query). Karta shu mavzu va o'yin bilan kirish modalini ochadi. Savollari yetmagan mavzuda — izoh.
 */
export function TopicGamesBlock({ chapterId }: { chapterId: string }) {
  const t = useTranslations("games");
  const topic = useQuery(gameQueries.topic(gameTopicSlug(chapterId)));
  const [game, setGame] = useState<GameId | null>(null);

  return (
    <section
      className="font-game border-border bg-surface text-foreground @container overflow-hidden rounded-[32px] border font-semibold"
      aria-labelledby="topic-games-title"
      data-testid="topic-games"
    >
      <div className="border-border flex items-center gap-3.5 border-b px-[26px] py-[22px]">
        <span className="bg-game-banner text-game-indigo flex size-11 shrink-0 items-center justify-center rounded-[14px]">
          <Gamepad2 className="size-[22px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3
            id="topic-games-title"
            className="text-2xl leading-tight font-extrabold tracking-[-0.5px]"
          >
            {t("topicBlock.title")}
          </h3>
          <p className="text-muted mt-0.5 text-sm">
            {topic.data
              ? t("topicBlock.leadTopic", {
                  topic: topic.data.title,
                  count: topic.data.question_count,
                })
              : t("topicBlock.lead")}
          </p>
        </div>
      </div>

      <div className="bg-background px-[26px] pt-6 pb-7">
        {topic.isPending ? (
          <div className="grid gap-5 @3xl:grid-cols-3">
            {GAME_IDS.map((id) => (
              <Skeleton key={id} className="h-32 rounded-[24px] @3xl:h-[320px]" />
            ))}
          </div>
        ) : topic.isError ? (
          <p className="text-muted text-sm" role="alert">
            {t("topicBlock.error")}
          </p>
        ) : !topic.data ? (
          <p className="text-muted text-sm" data-testid="topic-games-unavailable">
            {t("topicBlock.unavailable")}
          </p>
        ) : (
          <>
            <ul className="grid gap-5 @3xl:grid-cols-3">
              {GAME_IDS.map((id) => {
                const key = GAME_KEYS[id];
                return (
                  <li key={id} data-game={key}>
                    <button
                      type="button"
                      onClick={() => setGame(id)}
                      className="group border-border bg-surface focus-visible:ring-game-indigo/50 flex h-full w-full overflow-hidden rounded-[24px] border text-left shadow-[0_4px_0_var(--color-border)] transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_8px_0_var(--color-border)] focus-visible:ring-4 focus-visible:outline-none motion-reduce:hover:translate-y-0 @3xl:flex-col"
                    >
                      <span className="relative flex w-[120px] flex-none items-center justify-center bg-[var(--game-soft)] @3xl:h-[170px] @3xl:w-auto">
                        <span className="text-game-boot absolute top-3.5 left-3.5 hidden rounded-full bg-white/90 px-2.5 py-[5px] text-xs font-extrabold @3xl:inline-flex">
                          {t(`list.${key}.badge`)}
                        </span>
                        <span className="flex size-[60px] items-center justify-center rounded-[20px] bg-[var(--game)] text-white transition-transform duration-200 group-hover:scale-[1.08] group-hover:-rotate-[4deg] motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0 @3xl:size-[88px] @3xl:rounded-[28px]">
                          <GameGlyph game={id} size={40} strokeWidth={1.9} />
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col gap-2 px-5 pt-[18px] pb-5">
                        <span className="text-[22px] leading-tight font-extrabold">
                          {t(`list.${key}.name`)}
                        </span>
                        <span className="text-muted text-[15px]">{t(`list.${key}.short`)}</span>
                        <span className="mt-1.5 inline-flex h-[38px] items-center gap-1.5 self-start rounded-full bg-[var(--game)] px-4 text-sm font-extrabold text-white">
                          {t("card.play")}
                          <ArrowRight className="size-4" strokeWidth={2.8} aria-hidden />
                        </span>
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
      </div>
    </section>
  );
}
