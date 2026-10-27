"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import { ApiError } from "@/lib/api/types";
import { getGamesApi } from "@/lib/games/api";
import { GAME_KEYS, TEAM_COLORS } from "@/lib/games/config";
import { rankTeams, winners } from "@/lib/games/scoring";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gamePlayPath, ROUTES } from "@/lib/utils/routes";
import { useGameHydrated, useGameStore } from "@/stores/game.store";
import { Confetti } from "./Confetti";
import { GameNotReady } from "./GamePlayView";
import { GameShell } from "./GameShell";
import { GameStartModal } from "./GameStartModal";

/** Server natijani bir marta qabul qiladi; takror (`session_finished`, 409) — allaqachon saqlangan. */
const SESSION_FINISHED = "session_finished";

/**
 * Natija: g'olib(lar), o'rinlar jadvali, konfetti. Kirgan foydalanuvchida natija server sessiyasiga
 * bir marta yoziladi. "Yana o'ynash" — shu mavzu va o'yin bilan kirish modali.
 */
export function GameResultView({ topicSlug }: { topicSlug: string }) {
  const t = useTranslations("games");
  const hydrated = useGameHydrated();
  const { game, topic, scores, session, startedAt, finishedAt } = useGameStore();
  const [saveError, setSaveError] = useState(false);
  const [replay, setReplay] = useState(false);
  const saved = useRef<string | null>(null);

  const router = useRouter();
  const ready = hydrated && game !== null && topic?.slug === topicSlug && finishedAt !== null;
  // O'yin hali davom etmoqda (yoki "Yana o'ynash" yangisini boshladi) — o'yin ekraniga.
  const playing = hydrated && game !== null && topic?.slug === topicSlug && finishedAt === null;

  useEffect(() => {
    if (playing && game) router.replace(gamePlayPath(topicSlug, game));
  }, [playing, game, router, topicSlug]);

  useEffect(() => {
    if (!ready || !session || saved.current === session) return;
    saved.current = session;
    const duration = Math.max(
      0,
      Math.round(((finishedAt ?? Date.now()) - (startedAt ?? Date.now())) / 1000),
    );
    getGamesApi()
      .finishSession(session, scores, duration)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === SESSION_FINISHED) return;
        setSaveError(true);
      });
  }, [ready, session, scores, startedAt, finishedAt]);

  if (!hydrated || playing) return <div className="min-h-dvh" aria-busy />;
  if (!ready || !game || !topic) return <GameNotReady />;

  const ranked = rankTeams(scores);
  const won = winners(scores);
  const headline =
    won.length === 0
      ? t("result.noWinner")
      : won.length > 1
        ? t("result.draw")
        : t("result.winner", { team: scores[won[0]].name });

  return (
    <GameShell game={game} title={t(`list.${GAME_KEYS[game]}.name`)} subtitle={topic.title}>
      {won.length > 0 && <Confetti />}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-7 pt-4 text-center sm:pt-8">
        <m.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            transition: { type: "spring", stiffness: 300, damping: 15 },
          }}
          className="flex size-24 items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,var(--game-from),var(--game-to))] text-white shadow-[0_18px_40px_-16px_var(--game-deep)]"
        >
          <Trophy className="size-12" aria-hidden />
        </m.span>
        <div className="flex flex-col gap-2">
          <p className="text-muted text-lg font-bold">{t("result.title")}</p>
          <h1
            className="text-[clamp(2rem,1.4rem+3vw,3.5rem)] leading-tight font-extrabold text-balance"
            data-testid="game-headline"
          >
            {headline}
          </h1>
        </div>
        <ol className="flex w-full flex-col gap-3" data-testid="game-ranking">
          {ranked.map((team) => (
            <li
              key={team.index}
              data-team={TEAM_COLORS[team.index]}
              className={cn(
                "flex items-center gap-4 rounded-[1.5rem] border-[3px] px-5 py-4 text-left",
                team.place === 1 && team.score > 0
                  ? "border-[var(--team)] bg-[color-mix(in_srgb,var(--team)_10%,var(--color-surface))]"
                  : "border-border bg-surface",
              )}
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--team)] text-xl font-extrabold text-white">
                {team.place}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-extrabold sm:text-2xl">
                  {team.name}
                </span>
                <span className="text-muted text-base font-semibold">
                  {t("result.place", { place: team.place })} ·{" "}
                  {t("result.accuracy", { correct: team.correct, total: team.total })}
                </span>
              </span>
              <span className="text-3xl font-extrabold tabular-nums sm:text-4xl">
                {t("result.score", { score: team.score })}
              </span>
            </li>
          ))}
        </ol>
        {saveError && (
          <p role="status" className="text-muted text-sm">
            {t("result.saveError")}
          </p>
        )}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setReplay(true)}
            className="game-press inline-flex h-14 items-center justify-center rounded-[1.125rem] bg-[var(--game-from)] px-8 text-lg font-extrabold text-white [--press-deep:var(--game-deep)]"
          >
            {t("result.playAgain")}
          </button>
          <Link
            href={ROUTES.games}
            className="game-press border-border bg-surface text-foreground inline-flex h-14 items-center justify-center rounded-[1.125rem] border-2 px-8 text-lg font-extrabold [--press-deep:var(--color-border)]"
          >
            {t("result.otherTopic")}
          </Link>
        </div>
      </div>
      <GameStartModal
        topic={replay ? topic : null}
        initialGame={game}
        onClose={() => setReplay(false)}
      />
    </GameShell>
  );
}
