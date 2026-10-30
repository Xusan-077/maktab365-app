"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/layout/Logo";
import { useSound } from "@/hooks/useSound";
import type { GameQuestion } from "@/lib/games/api";
import { TEAM_COLORS } from "@/lib/games/config";
import { replayAnimation } from "@/lib/games/replay-animation";
import {
  ROPE_BEEP_SECONDS,
  ROPE_BLOCK_MS,
  ROPE_LIMIT,
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
import { ghostButton, OptionGrid, primaryButton } from "./AnswerFeedback";
import { Confetti } from "./Confetti";
import { GameDialog } from "./GameDialog";
import { GameShell } from "./GameShell";
import { GameStartModal } from "./GameStartModal";
import { RopeScene } from "./RopeScene";
import { ScoreNumber, nextGainId, type ScoreGain } from "./TeamScore";
import { formatClock, useCountdownBeep } from "./TimeBar";
import { useQuestionRound } from "./useQuestionRound";

type Side = 0 | 1;

/** To'g'ri javobdan keyin yangi savol shuncha vaqtdan keyin. */
const CORRECT_PAUSE_MS = 650;
/** Ikki jamoa bir klaviaturada: ko'k — 1–4, qizil — 7, 8, 9, 0. */
const KEY_MAPS: Record<Side, (key: string) => number | null> = {
  0: (key) => (key.length === 1 && "1234".includes(key) ? "1234".indexOf(key) : null),
  1: (key) => (key.length === 1 && "7890".includes(key) ? "7890".indexOf(key) : null),
};
const WINNER_COLORS: Record<Side, readonly string[]> = {
  0: [
    "var(--color-team-blue)",
    "var(--color-game-kid-blue)",
    "var(--color-game-gold)",
    "var(--color-team-green)",
  ],
  1: [
    "var(--color-team-red)",
    "var(--color-game-kid-red)",
    "var(--color-game-gold)",
    "var(--color-team-green)",
  ],
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
export function RopeGame() {
  const t = useTranslations("games.play");
  const state = useGameStore();
  const rope = state.rope;
  const finished = state.finishedAt !== null;
  const remaining = useRemaining(rope?.endsAt ?? 0, !finished && rope !== null, () =>
    useGameStore.getState().finish(),
  );
  const [gains, setGains] = useState<Record<Side, ScoreGain | null>>({ 0: null, 1: null });
  useCountdownBeep(remaining, ROPE_BEEP_SECONDS, !finished && rope !== null);

  if (!rope) return null;
  const warning = remaining <= ROPE_WARNING_SECONDS;

  const side = (index: Side) => (
    <div
      data-team={TEAM_COLORS[index]}
      data-testid="team-score"
      className="flex items-center justify-center gap-3 pt-1.5"
    >
      {index === 1 && <RopeScore side={1} gain={gains[1]} />}
      <i aria-hidden className="size-3.5 shrink-0 rounded-full bg-[var(--team)]" />
      <span className="text-[15px] font-bold tracking-[0.3px] text-[var(--team-deep)] uppercase max-[1000px]:hidden">
        {state.scores[index]?.name}
      </span>
      {index === 0 && <RopeScore side={0} gain={gains[0]} />}
    </div>
  );

  return (
    <GameShell
      game="arqon-tortish"
      toolsAtBottom
      className="overflow-hidden"
      header={() => (
        <header
          className="grid grid-cols-[1fr_auto_1fr] items-start px-4 pt-[22px]"
          aria-label={t("scoresLabel")}
        >
          {side(0)}
          <div className="flex flex-col items-center gap-2.5">
            <Logo height={30} />
            <div
              role="timer"
              aria-label={t("rope.timerLabel", { time: formatClock(remaining) })}
              data-warning={warning || undefined}
              data-testid="rope-timer"
              className={cn(
                "flex items-center gap-2.5 rounded-full border-2 px-4 py-1.5 text-xl font-extrabold min-[1001px]:px-[26px] min-[1001px]:py-2 min-[1001px]:text-[28px]",
                warning
                  ? "border-game-err-ring bg-game-bad-soft text-game-err-dark shadow-[0_4px_0_var(--color-game-err-ring)]"
                  : "border-game-brand-ring bg-game-banner text-game-indigo shadow-[0_4px_0_var(--color-game-brand-ring)]",
              )}
            >
              <Clock className="size-[22px]" strokeWidth={2.4} aria-hidden />
              {formatClock(remaining)}
            </div>
          </div>
          {side(1)}
        </header>
      )}
    >
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 pb-[72px] min-[641px]:grid-cols-2 min-[1001px]:grid-cols-[minmax(300px,340px)_1fr_minmax(300px,340px)]">
        <RopePanel
          side={0}
          disabled={finished}
          onGain={(gain) => setGains((current) => ({ ...current, 0: gain }))}
        />
        <section className="relative order-first col-span-full flex h-[220px] min-w-0 items-center justify-center min-[1001px]:order-none min-[1001px]:col-span-1 min-[1001px]:h-auto">
          <div className="absolute top-9 bottom-9 left-1/2 border-l-2 border-dashed border-[var(--game-strong)]" />
          <div
            data-team="blue"
            className="absolute top-[20%] bottom-[20%] left-[8%] w-1.5 rounded-[3px] bg-[var(--team)] opacity-25"
          />
          <div
            data-team="red"
            className="absolute top-[20%] right-[8%] bottom-[20%] w-1.5 rounded-[3px] bg-[var(--team)] opacity-25"
          />
          <RopeScene position={rope.position} />
          <PositionDots position={rope.position} />
        </section>
        <RopePanel
          side={1}
          disabled={finished}
          onGain={(gain) => setGains((current) => ({ ...current, 1: gain }))}
        />
      </main>
      {finished && <RopeWinner key={state.finishedAt} />}
    </GameShell>
  );
}

function RopeScore({ side, gain }: { side: Side; gain: ScoreGain | null }) {
  const t = useTranslations("games.play");
  const team = useGameStore((state) => state.scores[side]);
  return (
    <>
      <span className="sr-only" aria-live="polite">
        {t("score", { team: team?.name ?? "", score: team?.score ?? 0 })}
      </span>
      <ScoreNumber score={team?.score ?? 0} gain={gain} className="text-[32px]" />
    </>
  );
}

/** Jamoa paneli: o'z savoli va 4 ta variant; javobdan keyin pauza, keyin yangi savol. */
function RopePanel({
  side,
  disabled,
  onGain,
}: {
  side: Side;
  disabled: boolean;
  onGain: (gain: ScoreGain) => void;
}) {
  const t = useTranslations("games.play");
  const { play } = useSound();
  const questions = useGameStore((state) => state.questions);
  const cursor = useGameStore((state) => state.rope?.cursor[side] ?? 0);
  const name = useGameStore((state) => state.scores[side]?.name ?? "");
  // Ko'rsatilayotgan savol: javobdan keyin pauza tugaguncha eskisi turadi.
  const [shown, setShown] = useState(cursor);
  const [result, setResult] = useState<{ id: number; correct: boolean } | null>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!result) return;
    const [animation, other] = result.correct
      ? ["game-anim-flash", "game-anim-shake"]
      : ["game-anim-shake", "game-anim-flash"];
    replayAnimation(panel.current, animation, other);
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
    <section
      ref={panel}
      data-team={TEAM_COLORS[side]}
      aria-label={t("rope.panelLabel", { team: name })}
      data-testid={`rope-panel-${side}`}
      data-blocked={blocked || undefined}
      className="bg-surface relative flex flex-col gap-3 rounded-[26px] border-2 border-[var(--team)] p-6"
    >
      <p className="text-xs font-bold tracking-[0.3px] text-[var(--team-deep)] uppercase">{name}</p>
      {question && (
        <RopeRound
          key={shown}
          side={side}
          question={question}
          disabled={disabled}
          onResolved={(correct, ms) => {
            const store = useGameStore.getState();
            store.ropeAnswer(side, correct);
            if (correct) store.noteFastest(side, ms);
            play(correct ? "pull" : "wrong");
            if (correct) onGain({ id: nextGainId(), points: 1 });
            setResult({ id: nextGainId(), correct });
          }}
        />
      )}
      {result?.correct && (
        <span
          key={result.id}
          aria-hidden
          className="game-anim-pull border-game-ok-ring bg-game-ok-soft text-game-ok-dark pointer-events-none absolute top-[38%] left-1/2 z-[3] rounded-full border-2 px-5 py-2 text-[30px] font-extrabold whitespace-nowrap"
        >
          {t("rope.pulled")}
        </span>
      )}
      {blocked && (
        <div
          className="bg-surface/60 game-anim-fade absolute inset-0 z-[2] flex items-center justify-center rounded-[24px]"
          role="status"
        >
          <span className="bg-game-err-dark rounded-full px-[18px] py-2.5 text-base font-extrabold text-white">
            {t("rope.blocked")}
          </span>
        </div>
      )}
    </section>
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
  onResolved: (correct: boolean, ms: number) => void;
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
        className="game-anim-up text-lg leading-[1.4] font-bold min-[641px]:text-[21px]"
        data-testid={`rope-question-${side}`}
      >
        {getLocalized(question.text, locale)}
      </h2>
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
        <img
          src={question.image}
          alt=""
          className="max-h-[18vh] w-auto self-center rounded-[16px] object-contain"
        />
      )}
      <OptionGrid question={question} round={round} className="mt-auto gap-3" />
    </>
  );
}

/** 11 nuqta: arqon belgisi qayerda (chap — ko'k, o'ng — qizil tomoni). */
function PositionDots({ position }: { position: number }) {
  const t = useTranslations("games.play");
  return (
    <div
      className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2.5 min-[1001px]:bottom-10"
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
                ? cn("size-4", side ? "bg-[var(--team)]" : "bg-game-indigo")
                : "size-2.5 bg-[var(--game-strong)]",
            )}
          />
        );
      })}
    </div>
  );
}

/** G'olib oynasi: konfetti, kubok; "Qayta o'ynash" yoki "Natijani ko'rish". */
function RopeWinner() {
  const t = useTranslations("games");
  const { play } = useSound();
  const router = useRouter();
  const titleId = useId();
  const { rope, scores, topic } = useGameStore();
  const [replay, setReplay] = useState(false);
  const position = rope?.position ?? 0;
  const winner = ropeFinalWinner(position);
  const resultRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    play("win");
    resultRef.current?.focus();
  }, [play]);
  if (!topic) return null;

  const description =
    winner === null
      ? t("play.rope.timeDraw")
      : Math.abs(position) >= ROPE_LIMIT
        ? t("play.rope.pulledAll", { steps: ROPE_LIMIT })
        : t("play.rope.timeSide");

  return (
    <GameDialog labelledBy={titleId} className="max-w-[520px] rounded-[28px]" testId="rope-winner">
      <Confetti colors={winner === null ? undefined : WINNER_COLORS[winner]} />
      <div className="flex flex-col items-center gap-3 p-9 text-center">
        <span
          data-team={winner === null ? undefined : TEAM_COLORS[winner]}
          className="game-anim-pop-in flex size-[88px] items-center justify-center rounded-full bg-[var(--team,var(--color-game-indigo))] text-white [animation-delay:.4s]"
        >
          <Trophy className="size-11" strokeWidth={2} aria-hidden />
        </span>
        <h2
          id={titleId}
          className="text-[32px] leading-tight font-extrabold tracking-[-0.5px]"
          data-testid="game-headline"
        >
          {winner === null ? t("result.draw") : t("result.winner", { team: scores[winner]?.name })}
        </h2>
        <p className="text-muted">{description}</p>
        <p className="mt-1 flex items-center gap-3.5 text-[22px] font-extrabold">
          <span className="text-team-blue">{scores[0]?.score}</span>
          <span className="text-muted">:</span>
          <span className="text-team-red">{scores[1]?.score}</span>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setReplay(true)}
            className={cn(primaryButton, "h-[46px] rounded-[14px] px-5 text-[15px]")}
          >
            {t("result.playAgain")}
          </button>
          <button
            ref={resultRef}
            type="button"
            onClick={() => router.push(gameResultPath(topic.slug))}
            className={cn(ghostButton, "h-[46px] rounded-[14px] px-5 text-[15px]")}
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
