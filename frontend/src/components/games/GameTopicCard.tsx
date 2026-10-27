"use client";

import { ListChecks } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { GameTopic } from "@/lib/games/api";
import { GAME_IDS, GAME_KEYS } from "@/lib/games/config";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { GameIcon } from "./GameIcon";

/** Mavzu kartasi: nom, fan · sinf · darslik, savollar soni, 3 o'yin ikonkasi. Butun karta — tugma. */
export function GameTopicCard({ topic, onPlay }: { topic: GameTopic; onPlay: () => void }) {
  const t = useTranslations("games");
  const locale = useLocale() as Locale;

  return (
    <article className="group border-border bg-surface hover:border-game-indigo/40 relative flex h-full flex-col gap-4 rounded-[1.5rem] border p-5 shadow-[0_8px_24px_-16px_rgb(15_23_42/0.25)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_rgb(79_91_224/0.45)] motion-reduce:hover:translate-y-0">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-foreground text-lg leading-snug font-bold text-balance">
          <button
            type="button"
            onClick={onPlay}
            aria-label={t("card.playLabel", { topic: topic.title })}
            className="after:ring-game-indigo/60 text-left after:absolute after:inset-0 after:rounded-[1.5rem] group-has-[button:focus-visible]:after:ring-3 focus-visible:outline-none"
          >
            {topic.title}
          </button>
        </h3>
        <p className="text-muted text-sm">
          {t("card.meta", {
            subject: getLocalized(topic.subject.title, locale),
            grade: topic.grade,
            textbook: getLocalized(topic.textbook.title, locale),
          })}
        </p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="bg-subtle text-foreground inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold">
          <ListChecks className="text-muted size-4" aria-hidden />
          {t("card.questions", { count: topic.question_count })}
        </span>
        <ul className="flex gap-1.5" aria-label={t("card.gamesLabel")}>
          {GAME_IDS.map((game) => (
            <li key={game} title={t(`list.${GAME_KEYS[game]}.name`)}>
              <span className="sr-only">{t(`list.${GAME_KEYS[game]}.name`)}</span>
              <GameIcon game={game} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
