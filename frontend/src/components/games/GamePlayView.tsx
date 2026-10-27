"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCountdown } from "@/hooks/useCountdown";
import { useSound } from "@/hooks/useSound";
import { getGamesApi, type GameQuestion } from "@/lib/games/api";
import { GAME_KEYS, SECONDS_PER_QUESTION, TEAM_COLORS, type GameId } from "@/lib/games/config";
import { answerPoints } from "@/lib/games/scoring";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gameResultPath, ROUTES } from "@/lib/utils/routes";
import { useGameHydrated, useGameStore } from "@/stores/game.store";
import { AnswerOption, OPTION_LETTERS, type AnswerState } from "./AnswerOption";
import { GameShell } from "./GameShell";
import { QuestionTimer } from "./QuestionTimer";
import { TeamScore } from "./TeamScore";

/** Klaviatura: 1–4 yoki A–D (lotin/kirill tartibida emas — faqat lotin harflari). */
export function keyToOption(key: string): number | null {
  const digit = "1234".indexOf(key);
  if (digit !== -1) return digit;
  const letter = "abcd".indexOf(key.toLowerCase());
  return letter === -1 || key.length !== 1 ? null : letter;
}

/**
 * O'yin ekrani: navbatdagi jamoa savolga javob beradi (30 s), javob serverda `answer_token` bilan
 * tekshiriladi, ball qo'shiladi. Uchala o'yin hozircha shu umumiy raund bilan o'ynaladi (o'yinga
 * xos sahna — quti, charx, arqon — keyingi bosqichda). Holat `useGameStore` da.
 */
export function GamePlayView({ topicSlug, game }: { topicSlug: string; game: GameId }) {
  const t = useTranslations("games");
  const hydrated = useGameHydrated();
  const router = useRouter();
  const state = useGameStore();
  const sound = useSound();
  const [gain, setGain] = useState<{ team: number; id: number; points: number } | null>(null);

  const ready =
    hydrated &&
    state.game === game &&
    state.topic?.slug === topicSlug &&
    state.questions.length > 0;
  const finished = ready && state.finishedAt !== null;

  useEffect(() => {
    if (finished) router.replace(gameResultPath(topicSlug));
  }, [finished, router, topicSlug]);

  if (!hydrated) return <div className="min-h-dvh" aria-busy />;
  if (!ready || !state.topic) return <GameNotReady />;

  const question = state.questions[state.index];
  return (
    <GameShell
      game={game}
      title={t(`list.${GAME_KEYS[game]}.name`)}
      subtitle={state.topic.title}
      sound={sound}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 sm:gap-7">
        <section aria-label={t("play.scoresLabel")} className="flex flex-wrap gap-2.5 sm:gap-4">
          {state.scores.map((team, index) => (
            <TeamScore
              key={index}
              name={team.name}
              color={TEAM_COLORS[index]}
              score={team.score}
              active={index === state.turn && !finished}
              gain={gain?.team === index ? gain : null}
            />
          ))}
        </section>
        {question && !finished && (
          <QuestionRound
            key={state.index}
            question={question}
            number={state.index + 1}
            total={state.questions.length}
            teamName={state.scores[state.turn]?.name ?? ""}
            teamColor={TEAM_COLORS[state.turn]}
            last={state.index + 1 >= state.questions.length}
            onAnswer={(correct, secondsLeft) => {
              state.answer(correct, secondsLeft);
              sound.play(correct ? "correct" : "wrong");
              setGain({
                team: state.turn,
                id: Date.now(),
                points: answerPoints(correct, secondsLeft),
              });
            }}
            onNext={() => {
              setGain(null);
              state.next();
            }}
          />
        )}
      </div>
    </GameShell>
  );
}

type Outcome =
  | { kind: "answered"; correct: boolean; selected: string; correctOptionId: string }
  | { kind: "timeout" };

function QuestionRound({
  question,
  number,
  total,
  teamName,
  teamColor,
  last,
  onAnswer,
  onNext,
}: {
  question: GameQuestion;
  number: number;
  total: number;
  teamName: string;
  teamColor: (typeof TEAM_COLORS)[number];
  last: boolean;
  onAnswer: (correct: boolean, secondsLeft: number) => void;
  onNext: () => void;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  const [checking, setChecking] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Javob bir marta hisoblanadi (taymer va tekshiruv javobi bir vaqtda kelsa ham).
  const settled = useRef(false);

  const expire = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onAnswer(false, 0);
    setOutcome({ kind: "timeout" });
  }, [onAnswer]);
  const remaining = useCountdown(
    SECONDS_PER_QUESTION,
    outcome === null && checking === null,
    expire,
  );

  const choose = useCallback(
    async (index: number) => {
      const option = question.options[index];
      if (!option || outcome || checking) return;
      setChecking(option.id);
      setError(false);
      const secondsLeft = remaining;
      try {
        const result = await getGamesApi().check(question.answer_token, option.id);
        if (settled.current) return;
        settled.current = true;
        onAnswer(result.correct, secondsLeft);
        setOutcome({
          kind: "answered",
          correct: result.correct,
          selected: option.id,
          correctOptionId: result.correct_option_id,
        });
      } catch {
        setError(true);
      } finally {
        setChecking(null);
      }
    },
    [question, outcome, checking, remaining, onAnswer],
  );

  // 1–4 / A–D bilan javob; javobdan keyin fokus "Keyingi" tugmasiga (Enter bilan davom).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || outcome) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const index = keyToOption(event.key);
      if (index === null) return;
      event.preventDefault();
      void choose(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, outcome]);
  useEffect(() => {
    if (outcome) nextRef.current?.focus();
  }, [outcome]);

  const stateOf = (optionId: string): AnswerState => {
    if (!outcome) return checking === optionId ? "selected" : "idle";
    if (outcome.kind === "timeout") return "dim";
    if (optionId === outcome.correctOptionId) return "correct";
    if (optionId === outcome.selected) return "wrong";
    return "dim";
  };
  const correctLetter =
    outcome?.kind === "answered" && !outcome.correct
      ? OPTION_LETTERS[
          question.options.findIndex((option) => option.id === outcome.correctOptionId)
        ]
      : null;

  return (
    <m.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col gap-5 sm:gap-6"
      aria-labelledby="game-question"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-base font-bold sm:text-lg">
          {t("question", { current: number, total })}
        </p>
        <p
          data-team={teamColor}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--team)] px-4 py-1.5 text-base font-extrabold text-white sm:text-lg"
          data-testid="game-turn"
        >
          {t("turn", { team: teamName })}
        </p>
      </div>
      <QuestionTimer remaining={remaining} total={SECONDS_PER_QUESTION} />
      <div className="border-border bg-surface flex flex-col items-center gap-4 rounded-[2rem] border-2 px-5 py-6 text-center shadow-[0_18px_40px_-28px_rgb(15_23_42/0.4)] sm:px-10 sm:py-10">
        {question.image && (
          // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
          <img
            src={question.image}
            alt=""
            className="max-h-[30vh] w-auto rounded-[1.25rem] object-contain"
          />
        )}
        <h1
          id="game-question"
          className="text-[clamp(1.5rem,1rem+2.4vw,3rem)] leading-tight font-extrabold text-balance"
        >
          {getLocalized(question.text, locale)}
        </h1>
      </div>
      <div
        className="grid gap-3 sm:grid-cols-2 sm:gap-4"
        role="group"
        aria-label={t("answersLabel")}
      >
        {question.options.map((option, index) => (
          <AnswerOption
            key={option.id}
            index={index}
            text={getLocalized(option.text, locale)}
            state={stateOf(option.id)}
            disabled={outcome !== null || checking !== null}
            onSelect={() => void choose(index)}
          />
        ))}
      </div>
      <div
        className="flex min-h-16 flex-col items-center gap-3 sm:flex-row sm:justify-between"
        aria-live="polite"
      >
        {outcome ? (
          <>
            <p
              className={cn(
                "text-2xl font-extrabold sm:text-3xl",
                outcome.kind === "answered" && outcome.correct ? "text-success" : "text-danger",
              )}
              data-testid="game-outcome"
            >
              {outcome.kind === "timeout"
                ? t("timeUp")
                : outcome.correct
                  ? t("correct")
                  : t("wrong")}
              {correctLetter && (
                <span className="text-foreground ml-3 text-lg font-bold sm:text-xl">
                  {t("correctAnswer", { letter: correctLetter })}
                </span>
              )}
            </p>
            <button
              ref={nextRef}
              type="button"
              onClick={onNext}
              data-testid="game-next"
              className="game-press focus-visible:ring-game-indigo/50 inline-flex h-14 min-w-56 items-center justify-center rounded-[1.125rem] bg-[var(--game-from)] px-6 text-lg font-extrabold text-white [--press-deep:var(--game-deep)] focus-visible:ring-4 focus-visible:outline-none"
            >
              {last ? t("finish") : t("next")}
            </button>
          </>
        ) : error ? (
          <p role="alert" className="text-danger text-lg font-semibold">
            {t("checkError")}
          </p>
        ) : (
          <p className="text-muted hidden text-sm font-semibold sm:block">{t("answerHint")}</p>
        )}
      </div>
    </m.section>
  );
}

export function GameNotReady() {
  const t = useTranslations("games.play");
  return (
    <div className="font-game flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={Gamepad2}
        className="w-full max-w-md rounded-[1.5rem]"
        action={
          <Link
            href={ROUTES.games}
            className="game-press bg-game-indigo inline-flex h-12 items-center rounded-[1rem] px-6 font-bold text-white"
          >
            {t("toGames")}
          </Link>
        }
      >
        {t("notReady")}
      </EmptyState>
    </div>
  );
}
