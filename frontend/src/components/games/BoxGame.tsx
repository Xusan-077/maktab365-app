"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Bomb, Check, Gift, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import type { useSound } from "@/hooks/useSound";
import type { GameQuestion } from "@/lib/games/api";
import { allOpened, specialPoints, type BoxCell } from "@/lib/games/box";
import { SECONDS_PER_QUESTION, TEAM_COLORS } from "@/lib/games/config";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { useGameStore } from "@/stores/game.store";
import { AnswerFeedback, OptionGrid, primaryButton } from "./AnswerFeedback";
import { GameDialog } from "./GameDialog";
import { GameShell } from "./GameShell";
import { QuestionTimer } from "./QuestionTimer";
import { ScoreNumber, nextGainId, type ScoreGain } from "./TeamScore";
import { useQuestionRound } from "./useQuestionRound";

/** Bonus/bomba qutisi ochilgach navbat shuncha vaqtdan keyin o'tadi (animatsiya ko'rinsin). */
const SPECIAL_PAUSE_MS = 1400;
const COLUMNS = 4;

type Sound = ReturnType<typeof useSound>;

/**
 * Sirli quti: raqamli qutilar to'ri. Savolli quti — savol modali (30 s), javobdan keyin
 * "Davom etish" bilan navbat keyingi jamoaga. Bonus (+2) / Bomba (−1) — savolsiz, navbat o'zi o'tadi.
 * Hamma quti ochilsa o'yin tugaydi.
 */
export function BoxGame({ title, sound }: { title: string; sound: Sound }) {
  const t = useTranslations("games.play");
  const state = useGameStore();
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [gain, setGain] = useState<(ScoreGain & { team: number }) | null>(null);
  const [notice, setNotice] = useState("");
  const team = state.scores[state.turn];
  const finished = state.finishedAt !== null;

  // Bonus/bomba: pauzadan keyin navbat o'tadi.
  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      setPending(null);
      useGameStore.getState().next();
    }, SPECIAL_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  // Sahifa yangilanganda oxirgi quti ochilgan, lekin o'yin yopilmagan bo'lsa.
  useEffect(() => {
    if (!finished && openCell === null && pending === null && allOpened(state.boxes)) {
      useGameStore.getState().next();
    }
  }, [finished, openCell, pending, state.boxes]);

  const open = (index: number, box: BoxCell) => {
    if (box.result !== null || openCell !== null || pending !== null || finished) return;
    if (box.kind === "question") {
      setGain(null);
      setOpenCell(index);
      return;
    }
    const points = specialPoints(box.kind);
    state.openBox(index, box.kind);
    state.bonus(points);
    sound.play(points > 0 ? "correct" : "wrong");
    setGain({ team: state.turn, id: nextGainId(), points });
    setNotice(
      t(box.kind === "bonus" ? "box.bonusNotice" : "box.bombNotice", {
        team: team?.name ?? "",
        points: Math.abs(points),
      }),
    );
    setPending(index);
  };

  const rows = Math.ceil(state.boxes.length / COLUMNS);
  const question =
    openCell !== null ? state.questions[state.boxes[openCell]?.question ?? -1] : undefined;

  return (
    <GameShell
      game="sirli-quti"
      title={title}
      sound={sound}
      header={(controls) => (
        <BoxBanner title={title} controls={controls} gain={gain} finished={finished} />
      )}
    >
      <p className="sr-only" aria-live="polite">
        {notice}
      </p>
      <div
        className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-4 gap-2.5 pt-4 sm:gap-4 sm:pt-6"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(4.25rem, 1fr))` }}
        role="group"
        aria-label={t("box.board")}
        data-testid="box-board"
      >
        {state.boxes.map((box, index) => (
          <BoxTile
            key={index}
            number={index + 1}
            box={box}
            tone={(Math.floor(index / COLUMNS) + index) % 2 === 0 ? "a" : "b"}
            disabled={openCell !== null || pending !== null || finished}
            onOpen={() => open(index, box)}
          />
        ))}
      </div>
      {openCell !== null && question && team && (
        <BoxQuestion
          key={openCell}
          number={openCell + 1}
          question={question}
          teamName={team.name}
          teamColor={TEAM_COLORS[state.turn]}
          onResolved={(correct) => {
            state.answer(correct);
            state.openBox(openCell, correct ? "correct" : "wrong");
            sound.play(correct ? "correct" : "wrong");
            setGain({ team: state.turn, id: nextGainId(), points: correct ? 1 : 0 });
          }}
          onContinue={() => {
            setOpenCell(null);
            state.next();
          }}
        />
      )}
    </GameShell>
  );
}

/** Banner: nuqtali och indigo fon; chapda navbat, markazda jamoalar (faol — rangli plashkada). */
function BoxBanner({
  title,
  controls,
  gain,
  finished,
}: {
  title: string;
  controls: ReactNode;
  gain: (ScoreGain & { team: number }) | null;
  finished: boolean;
}) {
  const t = useTranslations("games.play");
  const { scores, turn, topic } = useGameStore();
  const active = scores[turn];

  return (
    <header className="bg-game-banner game-dots border-border border-b-2 px-3 py-3 sm:px-8 sm:py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <div className="min-w-0 flex-1 lg:flex-none">
          <p className="text-muted truncate text-sm font-semibold sm:text-base">
            {title} · {topic?.title}
          </p>
          {active && !finished && (
            <p
              className="text-foreground truncate text-lg font-extrabold sm:text-2xl"
              data-testid="game-turn"
            >
              {t("turn", { team: active.name })}
            </p>
          )}
        </div>
        <ul
          className="order-last flex w-full flex-wrap items-center justify-center gap-1.5 sm:gap-3 lg:order-none lg:w-auto"
          aria-label={t("scoresLabel")}
        >
          {scores.map((item, index) => {
            const current = index === turn && !finished;
            return (
              <li
                key={index}
                data-team={TEAM_COLORS[index]}
                data-active={current || undefined}
                data-testid="team-score"
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors duration-300 sm:gap-3 sm:px-5 sm:py-2",
                  current ? "text-white" : "text-foreground",
                )}
              >
                {current && (
                  <m.span
                    layoutId="box-turn-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[var(--team-deep)] shadow-[0_6px_16px_-6px_var(--team)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!current && (
                  <span
                    aria-hidden
                    className="relative size-3 shrink-0 rounded-full bg-[var(--team)]"
                  />
                )}
                <span className="relative max-w-[9rem] truncate text-sm font-bold sm:max-w-[14rem] sm:text-xl">
                  {item.name}
                </span>
                <span className="sr-only" aria-live="polite">
                  {t("score", { team: item.name, score: item.score })}
                </span>
                <span className="relative">
                  <ScoreNumber
                    score={item.score}
                    gain={gain?.team === index ? gain : null}
                    className="text-2xl sm:text-4xl"
                  />
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-2 sm:gap-3">{controls}</div>
      </div>
    </header>
  );
}

const TONE = {
  a: "bg-[linear-gradient(145deg,var(--color-game-tile-a-from),var(--color-game-tile-a-to))]",
  b: "bg-[linear-gradient(145deg,var(--color-game-tile-b-from),var(--color-game-tile-b-to))]",
};

function BoxTile({
  number,
  box,
  tone,
  disabled,
  onOpen,
}: {
  number: number;
  box: BoxCell;
  tone: "a" | "b";
  disabled: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("games.play.box");
  const tile =
    "flex h-full w-full items-center justify-center rounded-[1.25rem] sm:rounded-[1.5rem]";

  if (box.result === null) {
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={t("label", { n: number })}
        data-testid={`box-${number}`}
        className={cn(
          tile,
          TONE[tone],
          "game-press text-[clamp(1.75rem,0.8rem+4vw,4.75rem)] leading-none font-extrabold text-white [--press-deep:var(--color-game-tile-deep)] [text-shadow:0_3px_0_rgb(0_0_0/0.18)]",
          "focus-visible:ring-game-sun transition-transform hover:-translate-y-1 focus-visible:ring-4 focus-visible:outline-none disabled:cursor-default disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0",
        )}
      >
        {number}
      </button>
    );
  }

  const result = box.result;
  const Icon = { correct: Check, wrong: X, bonus: Gift, bomb: Bomb }[result];
  return (
    <m.div
      role="img"
      aria-label={t(`opened.${result}`, { n: number })}
      data-testid={`box-${number}`}
      data-result={result}
      style={{ transformPerspective: 600 }}
      initial={{ rotateY: 90 }}
      animate={{
        rotateY: 0,
        scale: result === "bonus" ? [1, 1.15, 1] : 1,
        x: result === "bomb" ? [0, -10, 10, -10, 10, 0] : 0,
        transition: {
          rotateY: { duration: 0.45, ease: "easeOut" },
          scale: { delay: 0.45, duration: 0.4 },
          x: { delay: 0.45, duration: 0.45 },
        },
      }}
      className={cn(
        tile,
        "flex-col gap-0.5 border-[3px]",
        result === "correct" && "border-team-green bg-game-ok-soft text-team-green-deep",
        result === "wrong" && "border-border bg-surface text-muted",
        result === "bonus" && "bg-game-amber border-transparent text-white",
        result === "bomb" && "bg-team-red-deep border-transparent text-white",
      )}
    >
      <Icon className="size-[clamp(1.75rem,1rem+2.5vw,3.25rem)]" strokeWidth={3} aria-hidden />
      <span className="text-sm font-extrabold sm:text-lg">
        {result === "bonus" ? t("bonusTag") : result === "bomb" ? t("bombTag") : number}
      </span>
    </m.div>
  );
}

function BoxQuestion({
  number,
  question,
  teamName,
  teamColor,
  onResolved,
  onContinue,
}: {
  number: number;
  question: GameQuestion;
  teamName: string;
  teamColor: (typeof TEAM_COLORS)[number];
  onResolved: (correct: boolean) => void;
  onContinue: () => void;
}) {
  const t = useTranslations("games.play");
  const locale = useLocale() as Locale;
  const titleId = useId();
  const round = useQuestionRound({ question, seconds: SECONDS_PER_QUESTION, onResolved });
  const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (round.outcome) continueRef.current?.focus();
  }, [round.outcome]);

  return (
    <GameDialog labelledBy={titleId} className="max-w-5xl" testId="box-question">
      <div className="bg-game-indigo px-5 pt-4 pb-5 text-white sm:px-8 sm:pt-5">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-2 font-extrabold">
            <span className="text-lg text-white/85 sm:text-xl">{t("box.modalLabel")}</span>
            <span className="text-game-sun text-4xl leading-none sm:text-6xl">{number}</span>
          </p>
          <p
            data-team={teamColor}
            className="truncate rounded-full bg-[var(--team-deep)] px-4 py-1.5 text-base font-extrabold sm:text-lg"
            data-testid="game-turn"
          >
            {t("turn", { team: teamName })}
          </p>
        </div>
        <QuestionTimer
          remaining={round.remaining}
          total={SECONDS_PER_QUESTION}
          tone="sun"
          className="mt-4"
        />
      </div>
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-7">
        <div className="flex flex-col items-center gap-4 text-center">
          {question.image && (
            // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
            <img
              src={question.image}
              alt=""
              className="max-h-[26vh] w-auto rounded-[1.25rem] object-contain"
            />
          )}
          <h1
            id={titleId}
            className="text-[clamp(1.5rem,1rem+2.2vw,2.75rem)] leading-tight font-extrabold text-balance"
          >
            {getLocalized(question.text, locale)}
          </h1>
        </div>
        <OptionGrid question={question} round={round} />
        {round.outcome ? (
          <AnswerFeedback outcome={round.outcome} correctIndex={round.correctIndex}>
            <button
              ref={continueRef}
              type="button"
              onClick={onContinue}
              className={primaryButton}
              data-testid="game-next"
            >
              {t("continue")}
            </button>
          </AnswerFeedback>
        ) : round.error ? (
          <p role="alert" className="text-danger text-center text-lg font-semibold">
            {t("checkError")}
          </p>
        ) : (
          <p className="text-muted hidden text-center text-sm font-semibold sm:block">
            {t("answerHint")}
          </p>
        )}
      </div>
    </GameDialog>
  );
}
