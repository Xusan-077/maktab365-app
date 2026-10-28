"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Gift } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import type { useSound } from "@/hooks/useSound";
import type { GameQuestion } from "@/lib/games/api";
import { SECONDS_PER_QUESTION, TEAM_COLORS } from "@/lib/games/config";
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
import { useGameStore } from "@/stores/game.store";
import { AnswerFeedback, OptionGrid, primaryButton, Sparks } from "./AnswerFeedback";
import { GameShell } from "./GameShell";
import { QuestionTimer } from "./QuestionTimer";
import { TeamScore, nextGainId, type ScoreGain } from "./TeamScore";
import { useQuestionRound } from "./useQuestionRound";
import { useSectorLabel, WheelDisc } from "./WheelDisc";

type Sound = ReturnType<typeof useSound>;
type Phase =
  { kind: "idle" } | { kind: "spinning"; rotation: number } | { kind: "landed"; sector: number };

/**
 * Omad charhi: navbatdagi jamoa charxni aylantiradi, tushgan sektor savolining ball qiymatini
 * belgilaydi ("×2" — ikki baravar, "Bonus" — savolsiz +2). Navbat 1→2→3 aylanadi; savollar
 * tugaganda o'yin tugaydi.
 */
export function WheelGame({ title, sound }: { title: string; sound: Sound }) {
  const t = useTranslations("games.play");
  const state = useGameStore();
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [gain, setGain] = useState<(ScoreGain & { team: number }) | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const finished = state.finishedAt !== null;
  const team = state.scores[state.turn];

  useEffect(() => {
    if (phase.kind !== "spinning") return;
    const timer = setTimeout(
      () => {
        const sector = sectorAt(phase.rotation, WHEEL_SECTORS.length);
        if (WHEEL_SECTORS[sector].kind === "bonus") {
          const { bonus, turn } = useGameStore.getState();
          bonus(WHEEL_BONUS_POINTS);
          sound.play("correct");
          setGain({ team: turn, id: nextGainId(), points: WHEEL_BONUS_POINTS });
        }
        setPhase({ kind: "landed", sector });
        // Mobil/planshetda panel charx ostida — savol ko'rinsin.
        panelRef.current?.scrollIntoView({
          block: "nearest",
          behavior: reduced ? "auto" : "smooth",
        });
      },
      reduced ? 150 : WHEEL_SPIN_SECONDS * 1000 + 150,
    );
    return () => clearTimeout(timer);
  }, [phase, reduced, sound]);

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
    sound.play("tick");
    setPhase({ kind: "spinning", rotation });
  };

  const next = (consumed: boolean) => {
    setPhase({ kind: "idle" });
    state.next(consumed);
  };

  const landed = phase.kind === "landed" ? WHEEL_SECTORS[phase.sector] : null;
  const question = state.questions[state.index];

  return (
    <GameShell game="omad-charhi" title={title} subtitle={state.topic?.title} sound={sound}>
      <div className="mx-auto grid w-full max-w-[96rem] flex-1 items-start gap-5 lg:grid-cols-[minmax(12rem,17rem)_minmax(0,520px)_minmax(20rem,1fr)] lg:gap-8">
        <section
          aria-label={t("scoresLabel")}
          className="flex gap-2.5 lg:flex-col lg:gap-4 lg:pt-6"
        >
          {state.scores.map((item, index) => (
            <TeamScore
              key={index}
              name={item.name}
              color={TEAM_COLORS[index]}
              score={item.score}
              active={index === state.turn && !finished}
              gain={gain?.team === index ? gain : null}
              className="lg:flex-none lg:py-4"
            />
          ))}
        </section>
        <div className="flex flex-col items-center gap-3 pt-2">
          <WheelDisc
            rotation={state.rotation}
            spinning={phase.kind === "spinning"}
            reduced={reduced}
            canSpin={phase.kind === "idle" && !finished}
            onSpin={spin}
          />
          <p className="text-muted text-base font-bold sm:text-lg" data-testid="wheel-left">
            {t("wheel.left", { count: Math.max(0, state.questions.length - state.index) })}
          </p>
        </div>
        <section
          data-team={TEAM_COLORS[state.turn]}
          className="bg-surface flex min-h-[18rem] flex-col gap-4 rounded-[2rem] border-[3px] border-[var(--team)] p-4 shadow-[0_18px_40px_-28px_var(--team)] transition-colors duration-300 sm:p-6"
          aria-labelledby="wheel-panel-title"
          data-testid="wheel-panel"
          ref={panelRef}
        >
          {landed && phase.kind === "landed" && landed.kind !== "bonus" && question ? (
            <WheelQuestion
              key={state.index}
              question={question}
              sector={phase.sector}
              points={sectorPoints(landed)}
              onResolved={(correct) => {
                const points = sectorPoints(landed);
                state.answer(correct, points);
                sound.play(correct ? "correct" : "wrong");
                setGain({ team: state.turn, id: nextGainId(), points: correct ? points : 0 });
              }}
              last={state.index + 1 >= state.questions.length}
              onNext={() => next(true)}
            />
          ) : landed?.kind === "bonus" ? (
            <BonusCard teamName={team?.name ?? ""} onNext={() => next(false)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p
                id="wheel-panel-title"
                className="text-2xl font-extrabold sm:text-3xl"
                data-testid="game-turn"
              >
                {t("turn", { team: team?.name ?? "" })}
              </p>
              <p className="text-muted text-lg font-semibold" aria-live="polite">
                {phase.kind === "spinning" ? t("wheel.spinning") : t("wheel.prompt")}
              </p>
              {phase.kind === "idle" && !finished && (
                <button type="button" onClick={spin} className={primaryButton}>
                  {t("wheel.spinLabel")}
                </button>
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
  onResolved,
  onNext,
}: {
  question: GameQuestion;
  sector: number;
  points: number;
  last: boolean;
  onResolved: (correct: boolean) => void;
  onNext: () => void;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  const label = useSectorLabel();
  const round = useQuestionRound({ question, seconds: SECONDS_PER_QUESTION, onResolved });
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (round.outcome) nextRef.current?.focus();
  }, [round.outcome]);
  const chip =
    "bg-subtle text-foreground rounded-full px-3.5 py-1 text-base font-extrabold sm:text-lg";

  return (
    <m.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4"
      data-testid="wheel-question"
    >
      <QuestionTimer remaining={round.remaining} total={SECONDS_PER_QUESTION} />
      <div className="flex flex-wrap gap-2">
        <span className={chip} data-testid="wheel-sector">
          {t("wheel.sector", { label: label(WHEEL_SECTORS[sector]) })}
        </span>
        <span className={chip} data-testid="wheel-points">
          {t("wheel.points", { points })}
        </span>
      </div>
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
        <img
          src={question.image}
          alt=""
          className="max-h-[22vh] w-auto self-center rounded-[1.25rem] object-contain"
        />
      )}
      <h1
        id="wheel-panel-title"
        className="text-[clamp(1.375rem,1rem+1.4vw,2.25rem)] leading-tight font-extrabold text-balance"
      >
        {getLocalized(question.text, locale)}
      </h1>
      <OptionGrid question={question} round={round} compact />
      {round.outcome ? (
        <AnswerFeedback outcome={round.outcome} correctIndex={round.correctIndex}>
          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className={primaryButton}
            data-testid="game-next"
          >
            {last ? t("finish") : t("next")}
          </button>
        </AnswerFeedback>
      ) : round.error ? (
        <p role="alert" className="text-danger text-lg font-semibold">
          {t("checkError")}
        </p>
      ) : (
        <p className="text-muted hidden text-sm font-semibold sm:block">{t("answerHint")}</p>
      )}
    </m.div>
  );
}

function BonusCard({ teamName, onNext }: { teamName: string; onNext: () => void }) {
  const t = useTranslations("games.play");
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus(), []);
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
      data-testid="wheel-bonus"
    >
      <span className="relative flex size-24 items-center justify-center">
        <Sparks count={18} />
        <m.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{
            scale: 1,
            rotate: 0,
            transition: { type: "spring", stiffness: 420, damping: 12 },
          }}
          className="bg-team-green-deep flex size-24 items-center justify-center rounded-[1.75rem] text-white"
        >
          <Gift className="size-12" aria-hidden />
        </m.span>
      </span>
      <p id="wheel-panel-title" className="text-3xl font-extrabold sm:text-4xl" role="status">
        {t("wheel.bonusTitle", { team: teamName, points: WHEEL_BONUS_POINTS })}
      </p>
      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        className={primaryButton}
        data-testid="game-next"
      >
        {t("continue")}
      </button>
    </div>
  );
}
