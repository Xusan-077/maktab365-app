"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSound } from "@/hooks/useSound";
import type { GameQuestion } from "@/lib/games/api";
import { allOpened, specialPoints, type BoxCell } from "@/lib/games/box";
import { SECONDS_PER_QUESTION, TEAM_COLORS, type TeamColor } from "@/lib/games/config";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gameResultPath } from "@/lib/utils/routes";
import { useGameStore } from "@/stores/game.store";
import { AnswerFeedback, OptionGrid, primaryButton, Sparks, whiteButton } from "./AnswerFeedback";
import { Confetti } from "./Confetti";
import { GameDialog } from "./GameDialog";
import { GameShell } from "./GameShell";
import { ScoreNumber, nextGainId, type ScoreGain } from "./TeamScore";
import { TimeBar } from "./TimeBar";
import { useQuestionRound } from "./useQuestionRound";

const COLUMNS = 4;

type TeamGain = ScoreGain & { team: number };

/**
 * Sirli quti: raqamli qutilar to'ri. Savolli quti — savol kartasi (30 s), Bonus (+2) / Bomba (−1) —
 * savolsiz karta; "Davom etish" bilan navbat keyingi jamoaga. Javobsiz yopilsa quti sarflanmaydi.
 * Hamma quti ochilsa "O'yin tugadi" oynasi.
 */
export function BoxGame() {
  const t = useTranslations("games.play");
  const sound = useSound();
  const state = useGameStore();
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [gain, setGain] = useState<TeamGain | null>(null);
  const earned = useRef(0);
  const team = state.scores[state.turn];
  const finished = state.finishedAt !== null;

  // Sahifa yangilanganda oxirgi quti ochilgan, lekin o'yin yopilmagan bo'lsa.
  useEffect(() => {
    if (!finished && openCell === null && allOpened(state.boxes)) useGameStore.getState().next();
  }, [finished, openCell, state.boxes]);

  const open = (index: number, box: BoxCell) => {
    if (box.result !== null || openCell !== null || finished) return;
    sound.play("open");
    earned.current = 0;
    setGain(null);
    setOpenCell(index);
  };

  const close = (index: number) => {
    setLast(index);
    setOpenCell(null);
    setGain({ team: state.turn, id: nextGainId(), points: earned.current });
    state.next();
  };

  const finishSpecial = (index: number, kind: "bonus" | "bomb") => {
    const points = specialPoints(kind);
    earned.current = points < 0 && (team?.score ?? 0) === 0 ? 0 : points;
    state.openBox(index, kind);
    state.bonus(points);
    close(index);
  };

  const box = openCell !== null ? state.boxes[openCell] : undefined;
  const question = box?.kind === "question" ? state.questions[box.question ?? -1] : undefined;
  const teamColor = TEAM_COLORS[state.turn];

  return (
    <GameShell
      game="sirli-quti"
      variant="round"
      className="bg-surface"
      header={(controls) => <BoxBanner controls={controls} gain={gain} finished={finished} />}
    >
      <main
        className="grid flex-1 [grid-auto-rows:minmax(80px,1fr)] grid-cols-4 gap-2 p-2.5 min-[721px]:[grid-auto-rows:minmax(110px,1fr)] min-[721px]:gap-2.5 min-[721px]:p-4"
        aria-label={t("box.board")}
        data-testid="box-board"
      >
        {state.boxes.map((cell, index) => (
          <BoxTile
            key={index}
            number={index + 1}
            box={cell}
            tone={(Math.floor(index / COLUMNS) + (index % COLUMNS)) % 2 === 0 ? "a" : "b"}
            flip={last === index}
            disabled={openCell !== null || finished}
            onOpen={() => open(index, cell)}
          />
        ))}
      </main>
      {openCell !== null && team && question && (
        <BoxQuestion
          key={openCell}
          number={openCell + 1}
          question={question}
          teamName={team.name}
          teamColor={teamColor}
          onResolved={(correct, ms) => {
            state.answer(correct);
            if (correct) state.noteFastest(state.turn, ms);
            state.openBox(openCell, correct ? "correct" : "wrong");
            sound.play(correct ? "correct" : "wrong");
            earned.current = correct ? 1 : 0;
          }}
          onCancel={() => setOpenCell(null)}
          onContinue={() => close(openCell)}
        />
      )}
      {openCell !== null && team && (box?.kind === "bonus" || box?.kind === "bomb") && (
        <BoxSurprise
          key={openCell}
          kind={box.kind}
          number={openCell + 1}
          teamName={team.name}
          teamColor={teamColor}
          onContinue={() => finishSpecial(openCell, box.kind as "bonus" | "bomb")}
        />
      )}
      {finished && <BoxEnd />}
    </GameShell>
  );
}

function BoxBanner({
  controls,
  gain,
  finished,
}: {
  controls: ReactNode;
  gain: TeamGain | null;
  finished: boolean;
}) {
  const t = useTranslations("games.play");
  const { scores, turn } = useGameStore();
  const active = scores[turn];

  return (
    <header className="bg-game-banner sticky top-0 z-10 flex h-[110px] flex-none items-center justify-center pt-[22px] min-[721px]:h-[130px] min-[721px]:pt-0">
      {active && !finished && (
        <div className="absolute top-[22px] left-6 hidden flex-col gap-1.5 min-[1101px]:flex">
          <b
            className="text-game-boot rounded-full bg-white/90 px-4 py-1.5 text-lg font-bold"
            data-testid="game-turn"
          >
            {t("turnLabel")} <span className="text-game-indigo">{active.name}</span>
          </b>
          <span className="text-muted pl-2 text-sm">{t("box.pick")}</span>
        </div>
      )}
      <ul
        className={cn(
          "flex justify-center min-[721px]:gap-[clamp(40px,12vw,220px)]",
          scores.length === 3 ? "gap-2" : "gap-6",
        )}
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
              className="flex min-w-0 flex-col items-center gap-1 min-[721px]:min-w-[180px]"
            >
              <span
                className={cn(
                  "rounded-[10px] px-2.5 py-0.5 text-center text-xl font-extrabold transition-colors duration-300 min-[721px]:px-4 min-[721px]:text-[clamp(24px,3vw,38px)]",
                  scores.length === 3 && "max-[720px]:px-1.5 max-[720px]:text-[15px]",
                  "leading-[1.15]",
                  current && "bg-[var(--team)] text-white",
                )}
              >
                {item.name}
              </span>
              <span className="sr-only" aria-live="polite">
                {t("score", { team: item.name, score: item.score })}
              </span>
              <ScoreNumber
                score={item.score}
                gain={gain?.team === index ? gain : null}
                className="text-[30px] min-[721px]:text-[40px]"
              />
            </li>
          );
        })}
      </ul>
      <div className="absolute top-2 right-2 flex gap-1.5 min-[721px]:top-[18px] min-[721px]:right-[18px] min-[721px]:gap-2.5">
        {controls}
      </div>
    </header>
  );
}

const TILE_RESULT = {
  correct: "border-game-ok-ring bg-game-ok-soft text-game-ok-mark",
  wrong: "border-border bg-surface text-[var(--game-strong)]",
  bonus: "border-game-gold-ring bg-game-bonus-soft text-game-gold-ink",
  bomb: "border-game-err-ring bg-game-bomb-soft text-game-err-dark",
} as const;

function BoxTile({
  number,
  box,
  tone,
  flip,
  disabled,
  onOpen,
}: {
  number: number;
  box: BoxCell;
  tone: "a" | "b";
  flip: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("games.play.box");
  const tile =
    "flex items-center justify-center rounded-[22px] text-[clamp(48px,6.5vw,88px)] leading-none font-extrabold [perspective:600px] focus-visible:ring-4 focus-visible:ring-game-gold focus-visible:outline-none";

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
          "text-white transition-transform duration-[120ms] [text-shadow:0_2px_0_rgb(0_0_0/0.18)] enabled:hover:-translate-y-[3px] disabled:cursor-default motion-reduce:enabled:hover:translate-y-0",
          tone === "a"
            ? "bg-game-tile-a shadow-[0_6px_0_var(--color-game-tile-a-deep)]"
            : "bg-game-tile-b shadow-[0_6px_0_var(--color-game-tile-b-deep)]",
        )}
      >
        {number}
      </button>
    );
  }

  const { result } = box;
  return (
    <button
      type="button"
      disabled
      aria-label={t(`opened.${result}`, { n: number })}
      data-testid={`box-${number}`}
      data-result={result}
      className={cn(tile, "cursor-default border-2", TILE_RESULT[result], flip && "game-anim-flip")}
    >
      {result === "wrong"
        ? t("wrongTag")
        : result === "bonus"
          ? t("bonusTag")
          : result === "bomb"
            ? t("bombTag")
            : number}
    </button>
  );
}

/** Savol/sovg'a kartasi: yuqori brand chiziq (jamoa, quti raqami, yopish, vaqt). */
function BoxCard({
  titleId,
  testId,
  number,
  teamName,
  teamColor,
  bar,
  onDismiss,
  children,
}: {
  titleId: string;
  testId: string;
  number: number;
  teamName: string;
  teamColor: TeamColor;
  bar?: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("games");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <GameDialog
      underBanner
      labelledBy={titleId}
      className="max-w-[1400px] rounded-[20px]"
      testId={testId}
    >
      <div className="bg-game-indigo relative flex h-[74px] items-center justify-center">
        <span
          data-team={teamColor}
          className="absolute top-5 left-[18px] hidden items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[15px] font-bold text-white min-[721px]:flex"
        >
          <i aria-hidden className="size-3 rounded-full bg-[var(--team)]" />
          {teamName}
        </span>
        <span className="text-game-gold text-[42px] font-extrabold">
          <span className="sr-only">{t("play.box.modalLabel")} </span>
          {number}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("modal.close")}
          data-testid="box-close"
          className="absolute top-[18px] right-4 flex size-[38px] items-center justify-center rounded-full bg-white/20 text-white focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none"
        >
          <X className="size-5" strokeWidth={3} aria-hidden />
        </button>
        {bar && <div className="absolute bottom-0 left-0 w-full">{bar}</div>}
      </div>
      {children}
    </GameDialog>
  );
}

function BoxQuestion({
  number,
  question,
  teamName,
  teamColor,
  onResolved,
  onCancel,
  onContinue,
}: {
  number: number;
  question: GameQuestion;
  teamName: string;
  teamColor: TeamColor;
  onResolved: (correct: boolean, ms: number) => void;
  onCancel: () => void;
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
  const correct = round.outcome?.kind === "answered" && round.outcome.correct;

  return (
    <BoxCard
      titleId={titleId}
      testId="box-question"
      number={number}
      teamName={teamName}
      teamColor={teamColor}
      bar={<TimeBar remaining={round.remaining} total={SECONDS_PER_QUESTION} />}
      onDismiss={() => {
        if (round.outcome) onContinue();
        else if (!round.locked) onCancel();
      }}
    >
      {correct && <Sparks />}
      <div className="flex flex-col gap-[22px] p-[18px] min-[721px]:px-8 min-[721px]:pt-[26px] min-[721px]:pb-7">
        {question.image && (
          // eslint-disable-next-line @next/next/no-img-element -- savol rasmi (R2), o'lchami noma'lum
          <img src={question.image} alt="" className="max-h-[220px] self-center rounded-[16px]" />
        )}
        <h1
          id={titleId}
          className="text-center text-[clamp(26px,3.2vw,42px)] leading-[1.25] font-bold"
        >
          {getLocalized(question.text, locale)}
        </h1>
        <OptionGrid question={question} round={round} large />
        {round.outcome ? (
          <AnswerFeedback
            outcome={round.outcome}
            question={question}
            correctIndex={round.correctIndex}
          >
            <button
              ref={continueRef}
              type="button"
              onClick={onContinue}
              className={whiteButton}
              data-testid="game-next"
            >
              {t("continue")}
            </button>
          </AnswerFeedback>
        ) : (
          round.error && (
            <p role="alert" className="text-game-err-dark text-center text-lg font-semibold">
              {t("checkError")}
            </p>
          )
        )}
      </div>
    </BoxCard>
  );
}

function BoxSurprise({
  kind,
  number,
  teamName,
  teamColor,
  onContinue,
}: {
  kind: "bonus" | "bomb";
  number: number;
  teamName: string;
  teamColor: TeamColor;
  onContinue: () => void;
}) {
  const t = useTranslations("games.play");
  const { play } = useSound();
  const titleId = useId();
  const bonus = kind === "bonus";
  const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    play(bonus ? "bonus" : "bomb");
    continueRef.current?.focus();
  }, [bonus, play]);

  return (
    <BoxCard
      titleId={titleId}
      testId="box-surprise"
      number={number}
      teamName={teamName}
      teamColor={teamColor}
      onDismiss={onContinue}
    >
      {bonus && <Sparks />}
      <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
        <div
          className={cn(
            "text-[120px] leading-none font-extrabold [animation-iteration-count:2]",
            bonus ? "text-game-gold-ink game-anim-pop" : "text-game-err-dark game-anim-shake",
          )}
        >
          {t(bonus ? "box.bonusTag" : "box.bombTag")}
        </div>
        <h2 id={titleId} className="text-[40px] leading-tight font-extrabold">
          {t(bonus ? "box.bonusTitle" : "box.bombTitle")}
        </h2>
        <p className="text-muted text-xl">{t(bonus ? "box.bonusText" : "box.bombText")}</p>
        <button
          ref={continueRef}
          type="button"
          onClick={onContinue}
          className={cn(primaryButton, "mt-3.5")}
          data-testid="game-next"
        >
          {t("continue")}
        </button>
      </div>
    </BoxCard>
  );
}

function BoxEnd() {
  const t = useTranslations("games.play");
  const { play } = useSound();
  const titleId = useId();
  const slug = useGameStore((state) => state.topic?.slug ?? "");
  useEffect(() => play("win"), [play]);

  return (
    <GameDialog labelledBy={titleId} className="max-w-[520px] rounded-[28px]" testId="box-end">
      <Confetti />
      <div className="flex flex-col items-center gap-3 p-9 text-center">
        <h2 id={titleId} className="text-[44px] leading-tight font-extrabold tracking-[-1px]">
          {t("box.endTitle")}
        </h2>
        <p className="text-muted text-lg">{t("box.endText")}</p>
        <Link
          href={gameResultPath(slug)}
          className={cn(primaryButton, "mt-3")}
          data-testid="game-see-result"
        >
          {t("seeResult")}
        </Link>
      </div>
    </GameDialog>
  );
}
