"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSound } from "@/hooks/useSound";
import type { GameQuestion } from "@/lib/games/api";
import { SECONDS_PER_QUESTION, TEAM_COLORS } from "@/lib/games/config";
import { replayAnimation } from "@/lib/games/replay-animation";
import {
  sectorAt,
  sectorPoints,
  spinRotation,
  WHEEL_BONUS_POINTS,
  WHEEL_SECTORS,
  WHEEL_SPIN_SECONDS,
} from "@/lib/games/wheel";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { useGameStore } from "@/stores/game.store";
import { AnswerFeedback, OptionGrid, primaryButton, Sparks, whiteButton } from "./AnswerFeedback";
import { GameIcon } from "./GameIcon";
import { GameShell } from "./GameShell";
import { TeamScore, nextGainId, type ScoreGain } from "./TeamScore";
import { formatClock, TimeBar, useCountdownBeep } from "./TimeBar";
import { useQuestionRound } from "./useQuestionRound";
import { useSectorLabel, WheelDisc } from "./WheelDisc";

const TICK_MS = 160;
const TICK_COUNT = 22;
const LOW_SECONDS = 5;

type Phase =
  { kind: "idle" } | { kind: "spinning"; rotation: number } | { kind: "landed"; sector: number };

/**
 * Omad charhi: navbatdagi jamoa charxni aylantiradi, tushgan sektor savolning ball qiymatini
 * belgilaydi ("×2" — ikki baravar, "Bonus" — savolsiz +2). Savollar tugaganda o'yin tugaydi.
 */
export function WheelGame({ title }: { title: string }) {
  const t = useTranslations("games.play");
  const { play } = useSound();
  const state = useGameStore();
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [gain, setGain] = useState<(ScoreGain & { team: number }) | null>(null);
  const [left, setLeft] = useState<{ seconds: number; running: boolean }>({
    seconds: SECONDS_PER_QUESTION,
    running: false,
  });
  const panelRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const finished = state.finishedAt !== null;
  const team = state.scores[state.turn];
  const total = state.questions.length;

  useEffect(() => {
    if (phase.kind !== "spinning") return;
    let ticks = 0;
    const ticker = setInterval(() => {
      replayAnimation(pointerRef.current, "game-anim-pointer");
      play("tick");
      ticks += 1;
      if (ticks > TICK_COUNT) clearInterval(ticker);
    }, TICK_MS);
    const timer = setTimeout(
      () => {
        const sector = sectorAt(phase.rotation, WHEEL_SECTORS.length);
        if (WHEEL_SECTORS[sector].kind === "bonus") {
          const { bonus, turn } = useGameStore.getState();
          bonus(WHEEL_BONUS_POINTS);
          play("bonus");
          setGain({ team: turn, id: nextGainId(), points: WHEEL_BONUS_POINTS });
        } else {
          play("land");
        }
        setPhase({ kind: "landed", sector });
        // Mobil/planshetda panel charx ostida — savol ko'rinsin.
        panelRef.current?.scrollIntoView({
          block: "nearest",
          behavior: reduced ? "auto" : "smooth",
        });
      },
      reduced ? 150 : WHEEL_SPIN_SECONDS * 1000 + 200,
    );
    return () => {
      clearInterval(ticker);
      clearTimeout(timer);
    };
  }, [phase, reduced, play]);

  const spin = () => {
    if (phase.kind !== "idle" || finished) return;
    setGain(null);
    const target = Math.floor(Math.random() * WHEEL_SECTORS.length);
    const rotation = spinRotation(
      state.rotation,
      target,
      WHEEL_SECTORS.length,
      5,
      Math.random() - 0.5,
    );
    state.spin(rotation);
    setPhase({ kind: "spinning", rotation });
  };
  const spinRef = useRef(spin);
  useEffect(() => {
    spinRef.current = spin;
  });

  // Bo'sh joyda Space — aylantirish.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || (event.target as HTMLElement | null)?.closest("button, a")) return;
      event.preventDefault();
      spinRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const next = (consumed: boolean) => {
    setPhase({ kind: "idle" });
    setLeft({ seconds: SECONDS_PER_QUESTION, running: false });
    state.next(consumed);
  };

  const landed = phase.kind === "landed" ? WHEEL_SECTORS[phase.sector] : null;
  const question = state.questions[state.index];
  const low = left.running && left.seconds <= LOW_SECONDS;
  useCountdownBeep(left.seconds, LOW_SECONDS, left.running);

  return (
    <GameShell
      game="omad-charhi"
      fullscreen={false}
      className="gap-[18px] px-4 pt-[22px] pb-4"
      header={(controls) => (
        <header className="flex items-center justify-between gap-2 px-0 min-[601px]:gap-4 min-[601px]:px-2">
          <div className="flex min-w-0 items-center gap-3.5">
            <GameIcon game="omad-charhi" className="max-[600px]:hidden" />
            <div className="min-w-0">
              <h1 className="text-xl leading-[1.1] font-extrabold tracking-[-0.5px] min-[601px]:text-[26px]">
                {title}
              </h1>
              <p className="text-muted text-[13px] max-[600px]:hidden" data-testid="wheel-progress">
                {t("wheel.progress", {
                  topic: state.topic?.title ?? "",
                  grade: state.topic?.grade ?? 0,
                  asked: Math.min(state.index + 1, total),
                  total,
                })}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-full border-2 border-[var(--game-ring)] bg-[var(--game-soft)] px-4 py-1.5 text-xl font-extrabold text-[var(--game-ink)] shadow-[0_4px_0_var(--game-ring)] min-[1101px]:px-[26px] min-[1101px]:py-2 min-[1101px]:text-[26px]",
              low && "text-game-err-dark game-anim-pop [animation-iteration-count:infinite]",
            )}
            data-testid="wheel-timer"
            data-low={low || undefined}
          >
            <Clock className="size-5" strokeWidth={2.4} aria-hidden />
            <span>{formatClock(left.seconds)}</span>
          </div>
          <div className="flex shrink-0 gap-2.5">{controls}</div>
        </header>
      )}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 min-[1101px]:grid-cols-[280px_1fr_380px]">
        <aside
          aria-label={t("scoresLabel")}
          className="flex flex-row flex-wrap gap-4 min-[1101px]:flex-col"
        >
          {state.scores.map((item, index) => (
            <TeamScore
              key={index}
              name={item.name}
              color={TEAM_COLORS[index]}
              score={item.score}
              active={index === state.turn && !finished}
              gain={gain?.team === index ? gain : null}
              className="min-w-[150px] flex-1 min-[1101px]:flex-none"
            />
          ))}
          <p className="border-border bg-surface text-muted mt-auto hidden rounded-[18px] border-2 px-4 py-3.5 text-[13px] leading-normal min-[1101px]:block">
            {t("wheel.hint")}
          </p>
        </aside>

        <section className="flex min-w-0 items-center justify-center">
          <WheelDisc
            rotation={state.rotation}
            spinning={phase.kind === "spinning" && !reduced}
            canSpin={phase.kind === "idle" && !finished}
            pointerRef={pointerRef}
            onSpin={spin}
          />
        </section>

        <section
          ref={panelRef}
          data-team={TEAM_COLORS[state.turn]}
          aria-live="polite"
          data-testid="wheel-panel"
          className="bg-surface relative flex flex-col gap-3.5 overflow-hidden rounded-[26px] border-2 border-[var(--team)] p-6"
        >
          <p
            className="text-xs font-bold tracking-[0.3px] text-[var(--team)] uppercase"
            data-testid="game-turn"
          >
            {t("wheel.who", { team: team?.name ?? "" })}
          </p>
          {landed && phase.kind === "landed" && landed.kind !== "bonus" && question ? (
            <WheelQuestion
              key={state.index}
              question={question}
              sector={phase.sector}
              points={sectorPoints(landed)}
              last={state.index + 1 >= total}
              onTick={(seconds, running) => setLeft({ seconds, running })}
              onResolved={(correct, ms) => {
                const points = sectorPoints(landed);
                state.answer(correct, points);
                if (correct) state.noteFastest(state.turn, ms);
                play(correct ? "correct" : "wrong");
                setGain({ team: state.turn, id: nextGainId(), points: correct ? points : 0 });
              }}
              onNext={() => next(true)}
            />
          ) : landed?.kind === "bonus" ? (
            <BonusCard onNext={() => next(false)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center">
              <h2
                className={cn(
                  "text-2xl font-extrabold",
                  phase.kind === "spinning" && "text-[var(--game-ink)]",
                )}
              >
                {phase.kind === "spinning" ? t("wheel.spinning") : t("wheel.spinTitle")}
              </h2>
              {phase.kind !== "spinning" && (
                <p className="text-muted text-[15px] leading-normal">{t("wheel.prompt")}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </GameShell>
  );
}

function WheelQuestion({
  question,
  sector,
  points,
  last,
  onTick,
  onResolved,
  onNext,
}: {
  question: GameQuestion;
  sector: number;
  points: number;
  last: boolean;
  onTick: (seconds: number, running: boolean) => void;
  onResolved: (correct: boolean, ms: number) => void;
  onNext: () => void;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  const label = useSectorLabel();
  const round = useQuestionRound({ question, seconds: SECONDS_PER_QUESTION, onResolved });
  const nextRef = useRef<HTMLButtonElement>(null);
  const answered = round.outcome !== null;
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);
  const tick = useRef(onTick);
  useEffect(() => {
    tick.current = onTick;
  });
  useEffect(() => {
    tick.current(round.remaining, !answered);
  }, [round.remaining, answered]);
  const correct = round.outcome?.kind === "answered" && round.outcome.correct;

  return (
    <div className="game-anim-up flex flex-1 flex-col gap-3.5" data-testid="wheel-question">
      <div className="absolute top-0 left-0 w-full">
        <TimeBar
          remaining={round.remaining}
          total={SECONDS_PER_QUESTION}
          className="h-[5px] bg-[var(--team)]"
        />
      </div>
      {correct && <Sparks />}
      <div className="game-anim-pop-in flex flex-wrap gap-2 [animation-duration:.4s]">
        <span
          className="rounded-full bg-[var(--game-soft)] px-3 py-[5px] text-[13px] font-bold text-[var(--game-ink)]"
          data-testid="wheel-sector"
        >
          {t("wheel.sector", { label: label(WHEEL_SECTORS[sector]) })}
        </span>
        <span
          className="border-game-gold-ring bg-game-gold-soft text-game-gold-ink rounded-full border px-3 py-[5px] text-[13px] font-bold"
          data-testid="wheel-points"
        >
          {t("wheel.points", { points })}
        </span>
      </div>
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
        <img
          src={question.image}
          alt=""
          className="max-h-[22vh] w-auto self-center rounded-[16px] object-contain"
        />
      )}
      <h2 className="text-[21px] leading-[1.4] font-bold">{getLocalized(question.text, locale)}</h2>
      <OptionGrid question={question} round={round} className="mt-auto" />
      {round.outcome ? (
        <AnswerFeedback
          short
          outcome={round.outcome}
          question={question}
          correctIndex={round.correctIndex}
          points={points}
        >
          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className={cn(whiteButton, "h-[42px] px-4 text-sm")}
            data-testid="game-next"
          >
            {last ? t("finish") : t("next")}
          </button>
        </AnswerFeedback>
      ) : (
        round.error && (
          <p role="alert" className="text-game-err-dark text-sm font-semibold">
            {t("checkError")}
          </p>
        )
      )}
    </div>
  );
}

function BonusCard({ onNext }: { onNext: () => void }) {
  const t = useTranslations("games.play");
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus(), []);
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center"
      data-testid="wheel-bonus"
    >
      <Sparks />
      <div className="text-game-gold-ink game-anim-pop-in text-[80px] leading-none font-extrabold [animation-duration:.6s]">
        {t("points", { points: WHEEL_BONUS_POINTS })}
      </div>
      <h2 className="text-2xl font-extrabold">{t("wheel.bonusTitle")}</h2>
      <p className="text-muted text-[15px] leading-normal">{t("wheel.bonusText")}</p>
      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        className={cn(primaryButton, "mt-2.5")}
        data-testid="game-next"
      >
        {t("continue")}
      </button>
    </div>
  );
}
