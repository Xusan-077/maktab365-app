"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ArrowRight, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { INITIAL_PLAY_STATE, playReducer, type Pick, type PlayQuestion } from "@/lib/quizzes/play";
import { QuizQuestionScreen } from "./QuizQuestionScreen";
import { QuizTimer } from "./QuizTimer";

export interface CheckOutcome {
  correct: boolean;
  correctOptionId: string;
}

export interface PlayerResult {
  picks: Pick[];
  /** Soniyalarda. */
  timeSpent: number;
}

interface Props {
  questions: PlayQuestion[];
  /** Savolga soniya; `null` — taymersiz. */
  timePerQuestion: number | null;
  /** Javobni tekshiradi (`null` — vaqt tugadi). Egasi uchun mahalliy, ochiq testda server orqali. */
  check: (question: PlayQuestion, optionId: string | null) => Promise<CheckOutcome>;
  onFinish: (result: PlayerResult) => void;
}

/** Savollarni ketma-ket o'ynatadi: progress, taymer, javobdan keyin to'g'ri/noto'g'ri holat. */
export function QuizPlayer({ questions, timePerQuestion, check, onFinish }: Props) {
  const t = useTranslations("quizzes.play");
  const [state, dispatch] = useReducer(playReducer, INITIAL_PLAY_STATE);
  const [busy, setBusy] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const finished = useRef(false);

  const question = questions[state.index];
  const pick = state.phase === "revealed" ? (state.picks[state.picks.length - 1] ?? null) : null;
  const isLast = state.index === questions.length - 1;

  async function answer(optionId: string | null) {
    if (state.phase !== "answering" || busy) return;
    setBusy(true);
    setCheckFailed(false);
    try {
      const outcome = await check(question, optionId);
      dispatch({
        type: "reveal",
        pick: {
          questionId: question.id,
          optionId,
          // Vaqt tugagan savol hech qachon to'g'ri hisoblanmaydi.
          correct: optionId !== null && outcome.correct,
          correctOptionId: outcome.correctOptionId,
        },
      });
    } catch {
      setCheckFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    dispatch({ type: "next", total: questions.length });
  }

  useEffect(() => {
    if (state.phase !== "finished" || finished.current) return;
    finished.current = true;
    onFinish({ picks: state.picks, timeSpent: (Date.now() - startedAt) / 1000 });
  }, [state.phase, state.picks, onFinish, startedAt]);

  // Klaviatura: 1–6 — variant, Enter — keyingi savol.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (state.phase === "revealed" && event.key === "Enter") {
        event.preventDefault();
        next();
      } else if (state.phase === "answering" && /^[1-6]$/.test(event.key)) {
        const option = question?.options[Number(event.key) - 1];
        if (option) void answer(option.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!question) return null;

  return (
    <div className="flex flex-col gap-5" data-testid="quiz-player">
      <div className="flex flex-col gap-2">
        <div className="text-muted flex items-center justify-between text-sm font-medium">
          <span>{t("progress", { current: state.index + 1, total: questions.length })}</span>
        </div>
        <ProgressBar
          value={state.index + (state.phase === "revealed" ? 1 : 0)}
          max={questions.length}
          label={t("progressLabel")}
        />
        {timePerQuestion && (
          <QuizTimer
            key={question.id}
            seconds={timePerQuestion}
            running={state.phase === "answering" && !busy}
            onExpire={() => void answer(null)}
          />
        )}
      </div>

      <QuizQuestionScreen
        key={question.id}
        question={question}
        pick={pick}
        disabled={busy}
        onAnswer={(optionId) => void answer(optionId)}
      />

      {checkFailed && (
        <p role="alert" className="text-danger text-sm">
          {t("checkFailed")}
        </p>
      )}

      {state.phase === "revealed" && (
        <Button size="lg" className="self-end" onClick={next} autoFocus>
          {isLast ? <Flag className="size-4" aria-hidden /> : null}
          {t(isLast ? "finish" : "next")}
          {!isLast && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      )}
    </div>
  );
}
