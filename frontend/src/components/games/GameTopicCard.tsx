"use client";

import { CircleHelp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { GameTopic } from "@/lib/games/api";
import { GAME_IDS, GAME_KEYS, type GameId } from "@/lib/games/config";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { GameGlyph } from "./GameIcon";

/** Qidirilgan so'zni ajratib ko'rsatadi. */
function Highlight({ text, query }: { text: string; query?: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (!query || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-game-gold-ring text-foreground rounded-[4px] px-0.5">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/** Mavzu kartasi: fan, sinf, nom, darslik, savollar soni va 3 o'yin tugmasi (o'yin bilan modal ochadi). */
export function GameTopicCard({
  topic,
  query,
  index = 0,
  onPlay,
}: {
  topic: GameTopic;
  query?: string;
  index?: number;
  onPlay: (game: GameId) => void;
}) {
  const t = useTranslations("games");
  const locale = useLocale() as Locale;

  return (
    <article
      className="game-anim-up border-border bg-surface flex h-full flex-col gap-3.5 rounded-[24px] border p-5 shadow-[0_4px_0_var(--color-border)] transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_8px_0_var(--color-border)] motion-reduce:hover:translate-y-0"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
    >
      <div className="text-muted flex flex-wrap items-center gap-2 text-[13px]">
        <span className="bg-game-banner text-game-brand-ink rounded-full px-2.5 py-1 font-bold">
          {getLocalized(topic.subject.title, locale)}
        </span>
        <span>{t("page.grade", { grade: topic.grade })}</span>
      </div>
      <h3 className="text-foreground text-xl leading-[1.3] font-extrabold tracking-[-0.3px]">
        <Highlight text={topic.title} query={query} />
      </h3>
      <p className="text-muted text-sm">
        <Highlight text={getLocalized(topic.textbook.title, locale)} query={query} />
      </p>
      <div className="border-border mt-auto flex items-center justify-between gap-2.5 border-t border-dashed pt-3.5">
        <span className="flex items-center gap-1.5 text-[13px] text-[var(--game-text-2)]">
          <CircleHelp className="size-4" aria-hidden />
          {t("card.questions", { count: topic.question_count })}
        </span>
        <div className="flex gap-2">
          {GAME_IDS.map((game) => {
            const name = t(`list.${GAME_KEYS[game]}.name`);
            return (
              <button
                key={game}
                type="button"
                data-game={GAME_KEYS[game]}
                onClick={() => onPlay(game)}
                aria-label={t("card.playGame", { topic: topic.title, game: name })}
                title={name}
                className="focus-visible:ring-game-indigo/50 flex size-11 items-center justify-center rounded-[14px] bg-[var(--game)] text-white transition-transform duration-150 hover:-translate-y-[3px] hover:-rotate-[4deg] focus-visible:ring-4 focus-visible:outline-none motion-reduce:hover:translate-y-0 motion-reduce:hover:rotate-0"
              >
                <GameGlyph game={game} size={22} />
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
