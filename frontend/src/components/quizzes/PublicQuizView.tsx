"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/types";
import { getQuizzesApi } from "@/lib/quizzes/api";
import { buildPlayQuestions, buildReview, scoreOf, type PlayQuestion } from "@/lib/quizzes/play";
import { quizQueries } from "@/lib/quizzes/queries";
import type { PublicQuiz } from "@/lib/quizzes/types";
import { QuizCover } from "./QuizCover";
import { QuizPlayer, type CheckOutcome, type PlayerResult } from "./QuizPlayer";
import { QuizResult } from "./QuizResult";

/** Ochiq testda javob serverda tekshiriladi; vaqt tugasa ham variant yuboriladi, lekin natija "noto'g'ri". */
function remoteCheck(quiz: PublicQuiz) {
  return async (question: PlayQuestion, optionId: string | null): Promise<CheckOutcome> => {
    const probe = optionId ?? question.options[0]?.id;
    if (!probe) throw new Error("question has no options");
    const result = await getQuizzesApi().publicCheck(quiz.id, question.id, probe);
    return {
      correct: optionId !== null && result.correct,
      correctOptionId: result.correct_option_id,
    };
  };
}

function PublicSession({ quiz }: { quiz: PublicQuiz }) {
  const t = useTranslations("quizzes.public");
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<PlayerResult | null>(null);

  const questions = useMemo(
    () =>
      buildPlayQuestions(quiz.questions, {
        shuffleQuestions: quiz.shuffle_questions,
        shuffleOptions: quiz.shuffle_options,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quiz, run],
  );
  const finish = useCallback((finished: PlayerResult) => setResult(finished), []);

  if (result) {
    return (
      <QuizResult
        score={scoreOf(result.picks)}
        total={questions.length}
        timeSpent={result.timeSpent}
        review={buildReview(questions, result.picks)}
        onReplay={() => {
          setResult(null);
          setRun((value) => value + 1);
        }}
      >
        <p className="text-muted basis-full text-sm">{t("notSaved")}</p>
      </QuizResult>
    );
  }

  if (!started) {
    return (
      <div className="border-border bg-surface overflow-hidden rounded-2xl border shadow-sm">
        <QuizCover src={quiz.cover_url} />
        <div className="flex flex-col gap-4 p-6">
          <div>
            {quiz.category && <p className="text-link text-sm font-medium">{quiz.category.name}</p>}
            <h1 className="text-2xl font-bold text-balance break-words">{quiz.title}</h1>
            {quiz.description && <p className="text-muted mt-2 break-words">{quiz.description}</p>}
          </div>
          <p className="text-muted text-sm">
            {t("meta", { count: quiz.questions.length })}
            {quiz.time_per_question && ` · ${t("timer", { seconds: quiz.time_per_question })}`}
          </p>
          <Button size="lg" className="self-start" onClick={() => setStarted(true)}>
            <Play className="size-4" aria-hidden />
            {t("start")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <QuizPlayer
      key={run}
      questions={questions}
      timePerQuestion={quiz.time_per_question}
      check={remoteCheck(quiz)}
      onFinish={finish}
    />
  );
}

/** `/test/[id]`: havola orqali ochiladigan test (login shart emas, natija saqlanmaydi). */
export function PublicQuizView({ quizId }: { quizId: string }) {
  const t = useTranslations("quizzes.public");
  const quiz = useQuery(quizQueries.publicQuiz(quizId));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <Logo />
      </header>
      {quiz.isPending ? (
        <div className="flex flex-col gap-4" aria-busy aria-label={t("loading")}>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-6 w-2/3 rounded-md" />
        </div>
      ) : quiz.isError ? (
        <ErrorState
          variant={
            quiz.error instanceof ApiError && quiz.error.status === 404 ? "notFound" : "error"
          }
          standalone={false}
          onRetry={() => quiz.refetch()}
        />
      ) : (
        <PublicSession quiz={quiz.data} />
      )}
    </div>
  );
}
