"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RotateCcw, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSound } from "@/hooks/useSound";
import { ApiError } from "@/lib/api/types";
import { getGamesApi } from "@/lib/games/api";
import { GAME_KEYS, TEAM_COLORS } from "@/lib/games/config";
import { rankTeams, winners, type RankedTeam } from "@/lib/games/scoring";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gamePlayPath, ROUTES } from "@/lib/utils/routes";
import { useGameHydrated, useGameStore } from "@/stores/game.store";
import { ghostButton, primaryButton } from "./AnswerFeedback";
import { Confetti } from "./Confetti";
import { GameNotReady } from "./GamePlayView";
import { GameStartModal } from "./GameStartModal";

/** Server natijani bir marta qabul qiladi; takror (`session_finished`, 409) — allaqachon saqlangan. */
const SESSION_FINISHED = "session_finished";
const COUNT_UP_MS = 900;
/** Podium ustunlari: o'rin bo'yicha balandlik va chiqish kechikishi (2-1-3 tartibida turadi). */
const BAR_HEIGHT = [300, 220, 160];
const BAR_DELAY = [0.5, 0.2, 0];
const DRAW_HEIGHT = 260;

const percent = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

/** Ball 0 dan sanaladi (ease-out-cubic); kamaytirilgan harakatda darhol. */
function CountUp({ to, delay, className }: { to: number; delay: number; className?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const timer = setTimeout(() => {
      const start = performance.now();
      const step = (time: number) => {
        const progress = Math.min(1, (time - start) / COUNT_UP_MS);
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [to, delay]);
  return <span className={className}>{value}</span>;
}

/**
 * Natija: podium (1 jamoada — yulduzli karta), jamoalar natijasi, eng tez javob va davomiylik.
 * Kirgan foydalanuvchida natija server sessiyasiga bir marta yoziladi.
 */
export function GameResultView({ topicSlug }: { topicSlug: string }) {
  const t = useTranslations("games");
  const { play } = useSound();
  const hydrated = useGameHydrated();
  const { game, topic, scores, session, startedAt, finishedAt, fastest, questionCount } =
    useGameStore();
  const [saveError, setSaveError] = useState(false);
  const [replay, setReplay] = useState(false);
  // Qayta ko'rsatish — podium va konfetti noldan.
  const [celebration, setCelebration] = useState(0);
  const saved = useRef<string | null>(null);

  const router = useRouter();
  const ready = hydrated && game !== null && topic?.slug === topicSlug && finishedAt !== null;
  // O'yin hali davom etmoqda (yoki "Qayta o'ynash" yangisini boshladi) — o'yin ekraniga.
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

  useEffect(() => {
    if (ready) play("win");
  }, [ready, celebration, play]);

  if (!hydrated || playing) return <div className="min-h-dvh" aria-busy />;
  if (!ready || !game || !topic) return <GameNotReady />;

  const ranked = rankTeams(scores);
  const won = winners(scores);
  const draw = won.length > 1;
  const top = ranked[0];
  const eyebrow = `${t(`list.${GAME_KEYS[game]}.name`)} · ${topic.title}`;
  const minutes = Math.max(1, Math.round(((finishedAt ?? 0) - (startedAt ?? 0)) / 60000));
  const confettiColors =
    won.length === 1
      ? [
          `var(--color-team-${TEAM_COLORS[won[0]]})`,
          "var(--color-game-gold)",
          "var(--color-game-indigo)",
          "var(--color-team-green)",
          "var(--color-game-sector-2)",
        ]
      : undefined;

  return (
    <div
      data-game={GAME_KEYS[game]}
      className="font-game bg-background text-foreground relative grid min-h-dvh grid-cols-1 gap-7 overflow-hidden px-4 py-5 font-semibold min-[1001px]:grid-cols-[1fr_380px] min-[1001px]:px-8 min-[1001px]:py-7"
    >
      <Confetti key={celebration} colors={confettiColors} />
      <section key={celebration} className="flex min-w-0 flex-col items-center">
        <p className="game-anim-fade-up text-game-indigo text-sm font-bold tracking-[1px] uppercase">
          {eyebrow}
        </p>
        {scores.length === 1 ? (
          <Solo team={top} />
        ) : (
          <>
            <h1
              className="game-anim-fade-up mt-1.5 text-center text-[clamp(30px,4vw,48px)] font-extrabold tracking-[-1.2px] [--d:.1s]"
              data-testid="game-headline"
            >
              {won.length === 0
                ? t("result.noWinner")
                : draw
                  ? t("result.drawFull")
                  : t("result.winner", { team: top.name })}
            </h1>
            <p className="game-anim-fade-up text-muted mt-1 text-base [--d:.2s]">
              {t("result.subtitle", { score: top.score, correct: top.correct })}
            </p>
            <Podium ranked={ranked} draw={draw} />
          </>
        )}
      </section>

      <aside className="game-anim-fade-up flex flex-col gap-4 [--d:.5s]">
        <div className="border-border bg-surface rounded-[26px] border p-[22px]">
          <h2 className="mb-4 text-lg font-extrabold">{t("result.teamsTitle")}</h2>
          <ol className="flex flex-col gap-4" data-testid="game-ranking">
            {ranked.map((team, index) => {
              const value = percent(team.correct, team.total);
              return (
                <li
                  key={team.index}
                  data-team={TEAM_COLORS[team.index]}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2 text-[15px] font-bold">
                    <span className="flex min-w-0 items-center gap-2">
                      <i aria-hidden className="size-3 shrink-0 rounded-full bg-[var(--team)]" />
                      <span className="truncate">{team.name}</span>
                    </span>
                    <span className="text-muted shrink-0 text-sm font-semibold">
                      {t("result.accuracy", { correct: team.correct, total: team.total })} ·{" "}
                      <b className="text-foreground">{value}%</b>
                    </span>
                  </div>
                  <div className="bg-subtle h-2.5 overflow-hidden rounded-full">
                    <span
                      className="game-anim-grow block h-full rounded-full bg-[var(--team)]"
                      style={
                        { width: `${value}%`, "--d": `${0.8 + index * 0.15}s` } as CSSProperties
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="border-border bg-surface rounded-[20px] border p-4"
            data-testid="result-fastest"
          >
            <small className="text-muted text-[13px]">{t("result.fastest")}</small>
            <b className="mt-1 block text-[22px] font-extrabold">
              {fastest ? t("result.seconds", { seconds: fastest.seconds }) : t("result.noData")}
            </b>
            {fastest && (
              <span
                data-team={TEAM_COLORS[fastest.team]}
                className="text-[13px] text-[var(--team)]"
              >
                {scores[fastest.team]?.name}
              </span>
            )}
          </div>
          <div className="border-border bg-surface rounded-[20px] border p-4">
            <small className="text-muted text-[13px]">{t("result.duration")}</small>
            <b className="mt-1 block text-[22px] font-extrabold">
              {t("result.minutes", { minutes })}
            </b>
            <span className="text-muted text-[13px]">
              {t("result.questions", { count: questionCount })}
            </span>
          </div>
        </div>
        {saveError && (
          <p role="status" className="text-muted text-sm">
            {t("result.saveError")}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setCelebration((value) => value + 1)}
            className="border-game-brand-ring bg-game-banner text-game-brand-ink h-12 rounded-[14px] border border-dashed text-[15px] font-bold"
            data-testid="result-celebrate"
          >
            {t("result.celebrate")}
          </button>
          <button type="button" onClick={() => setReplay(true)} className={primaryButton}>
            <RotateCcw className="size-5" strokeWidth={2.6} aria-hidden />
            {t("result.playAgain")}
          </button>
          <Link href={ROUTES.games} className={ghostButton}>
            {t("result.otherGame")}
          </Link>
        </div>
      </aside>
      <GameStartModal
        topic={replay ? topic : null}
        initialGame={game}
        onClose={() => setReplay(false)}
      />
    </div>
  );
}

function Podium({ ranked, draw }: { ranked: RankedTeam[]; draw: boolean }) {
  const t = useTranslations("games.result");
  // Tartib ekranda: 2-o'rin, 1-o'rin, 3-o'rin.
  const order = ranked.length === 3 ? [1, 0, 2] : [1, 0];
  return (
    <div
      className="flex min-h-[380px] w-full flex-1 items-end justify-center gap-2.5 min-[1001px]:min-h-[460px] min-[1001px]:gap-[18px]"
      data-testid="podium"
    >
      {order.map((position) => {
        const team = ranked[position];
        const first = team.place === 1;
        const delay = BAR_DELAY[position];
        return (
          <div
            key={team.index}
            data-team={TEAM_COLORS[team.index]}
            className="flex w-[31%] flex-col items-center gap-3 min-[1001px]:w-[210px]"
          >
            {position === 0 && (
              <span className="game-anim-pop-in bg-game-gold text-game-gold-deep flex size-[72px] items-center justify-center rounded-full [animation-delay:1.1s] [animation-duration:.6s] min-[1001px]:size-[92px]">
                <Trophy className="game-anim-bob size-12" strokeWidth={2} aria-hidden />
              </span>
            )}
            <div
              className="game-anim-fade-up flex flex-col items-center gap-1"
              style={{ "--d": `${delay + 0.5}s` } as CSSProperties}
            >
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-[18px] bg-[var(--team)] text-2xl font-extrabold text-white"
              >
                {team.name[0]}
              </span>
              <b className="text-center text-lg font-extrabold">{team.name}</b>
            </div>
            <div
              className="game-anim-rise flex w-full flex-col items-center overflow-hidden rounded-t-[22px] bg-[var(--team)] pt-5 text-white"
              style={
                {
                  height: draw ? DRAW_HEIGHT : BAR_HEIGHT[position],
                  "--d": `${delay}s`,
                } as CSSProperties
              }
            >
              <CountUp
                to={team.score}
                delay={900}
                className={cn(
                  "font-extrabold tracking-[-2px]",
                  first
                    ? "text-[52px] min-[1001px]:text-[72px]"
                    : "text-[40px] min-[1001px]:text-[56px]",
                  "leading-none",
                )}
              />
              <span className="mt-1.5 text-sm font-bold opacity-90">{t("unit")}</span>
              <span className="mt-3.5 flex size-11 items-center justify-center rounded-full bg-white/20 text-xl font-extrabold">
                {team.place}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STAR_PATH = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z";

/** 1 jamoa: podium o'rniga ball va yulduzlar (≥85% — 3, ≥60% — 2). */
function Solo({ team }: { team: RankedTeam }) {
  const t = useTranslations("games.result");
  const value = percent(team.correct, team.total);
  const stars = value >= 85 ? 3 : value >= 60 ? 2 : 1;
  return (
    <>
      <h1
        className="game-anim-fade-up mt-1.5 text-center text-[clamp(30px,4vw,48px)] font-extrabold tracking-[-1.2px] [--d:.1s]"
        data-testid="game-headline"
      >
        {t("soloTitle")}
      </h1>
      <div
        className="game-anim-pop-in border-border bg-surface m-auto w-[min(520px,100%)] rounded-[28px] border p-9 text-center [animation-delay:.3s] [animation-duration:.6s]"
        data-testid="result-solo"
      >
        <CountUp
          to={team.score}
          delay={500}
          className="text-game-indigo text-[96px] leading-none font-extrabold tracking-[-3px]"
        />
        <p className="text-muted mt-1.5">
          {t("soloStat", { correct: team.correct, total: team.total, percent: value })}
        </p>
        <div className="my-4 flex justify-center gap-2.5" data-stars={stars}>
          {[0, 1, 2].map((index) => (
            <svg
              key={index}
              width="52"
              height="52"
              viewBox="0 0 24 24"
              aria-hidden
              className={cn(
                "game-anim-pop-in [animation-duration:.4s]",
                index < stars ? "fill-game-gold" : "fill-[var(--color-border)]",
              )}
              style={{ animationDelay: `${0.8 + index * 0.2}s` }}
            >
              <path d={STAR_PATH} />
            </svg>
          ))}
        </div>
        <p className="font-bold">{t(`stars${stars}` as "stars1" | "stars2" | "stars3")}</p>
      </div>
    </>
  );
}
