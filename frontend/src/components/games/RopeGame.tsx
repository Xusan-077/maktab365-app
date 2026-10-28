"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Lock, Timer, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, m } from "@/components/ui/motion";
import { Logo } from "@/components/layout/Logo";
import type { useSound } from "@/hooks/useSound";
import type { GameQuestion } from "@/lib/games/api";
import { TEAM_COLORS } from "@/lib/games/config";
import {
  ROPE_BLOCK_MS,
  ROPE_WARNING_SECONDS,
  ropeDots,
  ropeFinalWinner,
  ropeQuestionIndex,
} from "@/lib/games/rope";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gameResultPath } from "@/lib/utils/routes";
import { useGameStore } from "@/stores/game.store";
import { OptionGrid, primaryButton } from "./AnswerFeedback";
import { Confetti } from "./Confetti";
import { GameDialog } from "./GameDialog";
import { GameShell } from "./GameShell";
import { GameStartModal } from "./GameStartModal";
import { formatClock } from "./QuestionTimer";
import { ScoreNumber, nextGainId, type ScoreGain } from "./TeamScore";
import { TugOfWarArt } from "./TugOfWarArt";
import { useQuestionRound } from "./useQuestionRound";

type Sound = ReturnType<typeof useSound>;
type Side = 0 | 1;

/** To'g'ri javobdan keyin yangi savol shuncha vaqtdan keyin (yashil ko'rinsin). */
const CORRECT_PAUSE_MS = 700;
/** Ikki jamoa bir klaviaturada: chap — 1–4, o'ng — 6–9. */
const KEY_MAPS: Record<Side, (key: string) => number | null> = {
  0: (key) => ("1234".includes(key) && key.length === 1 ? "1234".indexOf(key) : null),
  1: (key) => ("6789".includes(key) && key.length === 1 ? "6789".indexOf(key) : null),
};
const WINNER_COLORS: Record<Side, readonly string[]> = {
  0: ["var(--color-team-blue)", "var(--color-team-blue-deep)", "var(--color-game-sun)"],
  1: ["var(--color-team-red)", "var(--color-team-red-deep)", "var(--color-game-sun)"],
};

/** Umumiy taymer: `endsAt` gacha qolgan soniya (sahifa yangilansa ham davom etadi). */
function useRemaining(endsAt: number, running: boolean, onExpire: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        clearInterval(timer);
        expire.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, endsAt]);
  return Math.max(0, (endsAt - now) / 1000);
}

/**
 * Arqon tortish: ikki jamoa bir vaqtda, har biri o'z savoliga (savollar ikkiga bo'lingan).
 * To'g'ri javob arqonni o'z tomoniga 1 qadam tortadi, xato — jamoa 1.5 s bloklanadi.
 * 5 qadam yoki 3:00 tugaganda oldinda turgan jamoa yutadi (teng — durang).
 */
export function RopeGame({ title, sound }: { title: string; sound: Sound }) {
  const t = useTranslations("games.play");
  const state = useGameStore();
  const rope = state.rope;
  const finished = state.finishedAt !== null;
  const remaining = useRemaining(rope?.endsAt ?? 0, !finished && rope !== null, () =>
    useGameStore.getState().finish(),
  );
  const [gains, setGains] = useState<Record<Side, ScoreGain | null>>({ 0: null, 1: null });

  if (!rope) return null;
  const warning = remaining <= ROPE_WARNING_SECONDS;

  return (
    <GameShell game="arqon-tortish" title={title} subtitle={state.topic?.title} sound={sound}>
      <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-4 sm:gap-5">
        <section
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6"
          aria-label={t("scoresLabel")}
        >
          {([0, 1] as const).map((side) => (
            <RopeScore
              key={side}
              side={side}
              name={state.scores[side]?.name ?? ""}
              score={state.scores[side]?.score ?? 0}
              gain={gains[side]}
            />
          ))}
          <div className="order-2 flex flex-col items-center gap-2">
            <Logo variant="mark" height={30} className="max-sm:hidden" />
            <p
              role="timer"
              aria-label={t("rope.timerLabel", { time: formatClock(remaining) })}
              data-warning={warning || undefined}
              data-testid="rope-timer"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xl font-extrabold text-white tabular-nums sm:px-5 sm:text-3xl",
                warning
                  ? "bg-team-red-deep motion-safe:animate-pulse"
                  : "bg-foreground text-background",
              )}
            >
              <Timer className="size-5 sm:size-7" aria-hidden />
              {formatClock(remaining)}
            </p>
          </div>
        </section>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,24rem)_minmax(0,1fr)] lg:gap-6">
          <RopePanel
            side={0}
            disabled={finished}
            sound={sound}
            onGain={(gain) => setGains((current) => ({ ...current, 0: gain }))}
          />
          <div className="flex flex-col justify-center max-lg:order-first">
            <TugOfWarArt position={rope.position} className="max-lg:mx-auto max-lg:max-w-md" />
          </div>
          <RopePanel
            side={1}
            disabled={finished}
            sound={sound}
            onGain={(gain) => setGains((current) => ({ ...current, 1: gain }))}
          />
        </div>

        <PositionDots position={rope.position} />
      </div>
      {finished && <RopeWinner key={state.finishedAt} />}
    </GameShell>
  );
}

function RopeScore({
  side,
  name,
  score,
  gain,
}: {
  side: Side;
  name: string;
  score: number;
  gain: ScoreGain | null;
}) {
  const t = useTranslations("games.play");
  return (
    <div
      data-team={TEAM_COLORS[side]}
      data-testid="team-score"
      className={cn(
        "flex min-w-0 items-center gap-2 sm:gap-4",
        side === 0 ? "order-1" : "order-3 flex-row-reverse text-right",
      )}
    >
      <span aria-hidden className="size-4 shrink-0 rounded-full bg-[var(--team)] sm:size-5" />
      <span className="line-clamp-2 min-w-0 text-sm leading-tight font-extrabold tracking-wide break-words uppercase sm:text-2xl">
        {name}
      </span>
      <span className="sr-only" aria-live="polite">
        {t("score", { team: name, score })}
      </span>
      <ScoreNumber score={score} gain={gain} className="text-3xl sm:text-6xl" />
    </div>
  );
}

/** Jamoa paneli: o'z savoli va 4 ta variant ustma-ust; javobdan keyin pauza, keyin yangi savol. */
function RopePanel({
  side,
  disabled,
  sound,
  onGain,
}: {
  side: Side;
  disabled: boolean;
  sound: Sound;
  onGain: (gain: ScoreGain) => void;
}) {
  const t = useTranslations("games.play");
  const questions = useGameStore((state) => state.questions);
  const cursor = useGameStore((state) => state.rope?.cursor[side] ?? 0);
  const name = useGameStore((state) => state.scores[side]?.name ?? "");
  // Ko'rsatilayotgan savol: javobdan keyin pauza tugaguncha eskisi turadi.
  const [shown, setShown] = useState(cursor);
  const [result, setResult] = useState<{ id: number; correct: boolean } | null>(null);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(
      () => {
        setResult(null);
        setShown(useGameStore.getState().rope?.cursor[side] ?? 0);
      },
      result.correct ? CORRECT_PAUSE_MS : ROPE_BLOCK_MS,
    );
    return () => clearTimeout(timer);
  }, [result, side]);

  const question = questions[ropeQuestionIndex(side, shown, questions.length)];
  const blocked = result !== null && !result.correct;

  return (
    <m.section
      data-team={TEAM_COLORS[side]}
      aria-label={t("rope.panelLabel", { team: name })}
      data-testid={`rope-panel-${side}`}
      data-blocked={blocked || undefined}
      animate={
        result?.correct
          ? {
              boxShadow: [
                "0 0 0 0 var(--team)",
                "0 0 0 14px color-mix(in srgb, var(--team) 35%, transparent)",
                "0 0 0 0 transparent",
              ],
              transition: { duration: 0.7 },
            }
          : blocked
            ? { x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.45 } }
            : { x: 0 }
      }
      className={cn(
        "bg-surface relative flex flex-col gap-4 rounded-[2rem] border-[3px] border-[var(--team)] p-4 sm:p-5",
        side === 0 ? "max-lg:order-2" : "max-lg:order-3",
      )}
    >
      <AnimatePresence>
        {result?.correct && (
          <m.span
            key={result.id}
            aria-hidden
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="text-team-green-deep dark:text-team-green pointer-events-none absolute top-6 left-1/2 z-10 -translate-x-1/2 text-3xl font-extrabold whitespace-nowrap"
          >
            {t("rope.pulled")}
          </m.span>
        )}
      </AnimatePresence>
      {question && (
        <RopeRound
          key={shown}
          side={side}
          question={question}
          disabled={disabled}
          onResolved={(correct) => {
            useGameStore.getState().ropeAnswer(side, correct);
            sound.play(correct ? "correct" : "wrong");
            if (correct) onGain({ id: nextGainId(), points: 1 });
            setResult({ id: nextGainId(), correct });
          }}
        />
      )}
      {blocked && (
        <div
          className="bg-surface/70 absolute inset-0 flex items-center justify-center rounded-[1.8rem] backdrop-blur-[2px]"
          role="status"
        >
          <span className="bg-team-red-deep inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-lg font-extrabold text-white">
            <Lock className="size-5" aria-hidden />
            {t("rope.blocked")}
          </span>
        </div>
      )}
      <p className="text-muted hidden text-sm font-semibold lg:block">
        {t("rope.keys", { keys: side === 0 ? "1–4" : "6–9" })}
      </p>
    </m.section>
  );
}

function RopeRound({
  side,
  question,
  disabled,
  onResolved,
}: {
  side: Side;
  question: GameQuestion;
  disabled: boolean;
  onResolved: (correct: boolean) => void;
}) {
  const locale = useLocale() as Locale;
  const round = useQuestionRound({
    question,
    seconds: null,
    onResolved,
    keyMap: KEY_MAPS[side],
    disabled,
  });
  return (
    <>
      <h2
        className="min-h-[3em] text-[clamp(1.25rem,0.9rem+1.2vw,2rem)] leading-tight font-extrabold text-balance"
        data-testid={`rope-question-${side}`}
      >
        {getLocalized(question.text, locale)}
      </h2>
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
        <img
          src={question.image}
          alt=""
          className="max-h-[18vh] w-auto self-center rounded-[1rem] object-contain"
        />
      )}
      <OptionGrid question={question} round={round} compact />
    </>
  );
}

/** 11 nuqta: arqon belgisi qayerda (chap — ko'k, o'ng — qizil tomoni). */
function PositionDots({ position }: { position: number }) {
  const t = useTranslations("games.play");
  return (
    <div
      className="flex items-center justify-center gap-1.5 sm:gap-3"
      role="img"
      aria-label={t("rope.position", { position })}
      data-testid="rope-dots"
    >
      {ropeDots().map((dot) => {
        const current = dot === position;
        const side = dot < 0 ? "blue" : dot > 0 ? "red" : null;
        return (
          <span
            key={dot}
            data-team={side ?? undefined}
            data-current={current || undefined}
            className={cn(
              "rounded-full transition-all duration-300",
              current
                ? "size-6 bg-[var(--team,var(--color-foreground))] ring-4 ring-[color-mix(in_srgb,var(--team,var(--color-foreground))_30%,transparent)] sm:size-8"
                : cn(
                    "size-3 sm:size-4",
                    side
                      ? "bg-[color-mix(in_srgb,var(--team)_35%,var(--color-surface))]"
                      : "bg-muted",
                  ),
            )}
          />
        );
      })}
    </div>
  );
}

/** G'olib modali: g'olib rangida konfetti, kubok pop; "Qayta o'ynash" yoki "Natijani ko'rish". */
function RopeWinner() {
  const t = useTranslations("games");
  const router = useRouter();
  const titleId = useId();
  const { rope, scores, topic } = useGameStore();
  const [replay, setReplay] = useState(false);
  const winner = ropeFinalWinner(rope?.position ?? 0);
  const resultRef = useRef<HTMLButtonElement>(null);
  useEffect(() => resultRef.current?.focus(), []);
  if (!topic) return null;

  return (
    <GameDialog labelledBy={titleId} className="max-w-lg" testId="rope-winner">
      {winner !== null && <Confetti colors={WINNER_COLORS[winner]} />}
      <div
        className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:px-10"
        data-team={winner === null ? undefined : TEAM_COLORS[winner]}
      >
        <m.span
          initial={{ scale: 0, rotate: -15 }}
          animate={{
            scale: 1,
            rotate: 0,
            transition: { type: "spring", stiffness: 360, damping: 11, delay: 0.1 },
          }}
          className={cn(
            "flex size-28 items-center justify-center rounded-[2rem] text-white",
            winner === null
              ? "bg-[linear-gradient(135deg,var(--game-from),var(--game-to))]"
              : "bg-[var(--team-deep)]",
          )}
        >
          <Trophy className="size-14" aria-hidden />
        </m.span>
        <h2
          id={titleId}
          className="text-[clamp(2rem,1.5rem+2vw,3rem)] leading-tight font-extrabold text-balance"
          data-testid="game-headline"
        >
          {winner === null ? t("result.draw") : t("result.winner", { team: scores[winner]?.name })}
        </h2>
        <p className="text-muted text-lg font-bold">
          {scores
            .map((team) => t("play.score", { team: team.name, score: team.score }))
            .join(" · ")}
        </p>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => setReplay(true)} className={primaryButton}>
            {t("result.playAgain")}
          </button>
          <button
            ref={resultRef}
            type="button"
            onClick={() => router.push(gameResultPath(topic.slug))}
            className="game-press border-border bg-surface text-foreground focus-visible:ring-game-indigo/50 inline-flex h-14 items-center justify-center rounded-[1.125rem] border-2 px-6 text-lg font-extrabold [--press-deep:var(--color-border)] focus-visible:ring-4 focus-visible:outline-none"
            data-testid="rope-see-result"
          >
            {t("play.seeResult")}
          </button>
        </div>
      </div>
      <GameStartModal
        topic={replay ? topic : null}
        initialGame="arqon-tortish"
        onClose={() => setReplay(false)}
      />
    </GameDialog>
  );
}
