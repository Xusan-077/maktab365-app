"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSaveAttempt } from "@/hooks/useQuizMutations";
import { ApiError } from "@/lib/api/types";
import { Link } from "@/lib/i18n/navigation";
import {
  buildPlayQuestions,
  buildReview,
  scoreOf,
  toAttemptInput,
  type PlayQuestion,
} from "@/lib/quizzes/play";
import { quizQueries } from "@/lib/quizzes/queries";
import type { Quiz } from "@/lib/quizzes/types";
import { quizPaths } from "@/lib/utils/routes";
import { QuizPlayer, type CheckOutcome, type PlayerResult } from "./QuizPlayer";
import { QuizResult } from "./QuizResult";

/** Ustoz o'z testida: javob egasi uchun mahalliy tekshiriladi, natija esa serverda qayta hisoblanib saqlanadi. */
function localCheck(quiz: Quiz) {
  return async (question: PlayQuestion, optionId: string | null): Promise<CheckOutcome> => {
    const options = quiz.questions.find((q) => q.id === question.id)?.options ?? [];
    const correct = options.find((o) => o.is_correct);
    if (!correct?.id) throw new Error("quiz has no correct option");
    return { correct: optionId !== null && optionId === correct.id, correctOptionId: correct.id };
  };
}

function PlaySession({ quiz }: { quiz: Quiz }) {
  const t = useTranslations("quizzes.play");
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<PlayerResult | null>(null);
  const save = useSaveAttempt(quiz.id);

  // `run` o'zgarsa savollar qayta aralashadi.
  const questions = useMemo(
    () =>
      buildPlayQuestions(quiz.questions, {
        shuffleQuestions: quiz.shuffle_questions ?? false,
        shuffleOptions: quiz.shuffle_options ?? false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quiz, run],
  );

  const finish = useCallback(
    (finished: PlayerResult) => {
      setResult(finished);
      save.mutate(toAttemptInput(questions, finished.picks, finished.timeSpent));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions],
  );

  function replay() {
    save.reset();
    setResult(null);
    setRun((value) => value + 1);
  }

  if (result) {
    return (
      <QuizResult
        score={scoreOf(result.picks)}
        total={questions.length}
        timeSpent={result.timeSpent}
        review={buildReview(questions, result.picks)}
        onReplay={replay}
      >
        <Link
          href={quizPaths.results(quiz.id)}
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          <History className="size-4" aria-hidden />
          {t("history")}
        </Link>
        <Link href={quizPaths.list()} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          <ListChecks className="size-4" aria-hidden />
          {t("backToList")}
        </Link>
        <p className="text-muted basis-full text-sm" role="status">
          {save.isPending && t("saving")}
          {save.isSuccess && t("saved")}
          {save.isError && (
            <>
              <span className="text-danger">{t("saveFailed")}</span>{" "}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  save.mutate(toAttemptInput(questions, result.picks, result.timeSpent))
                }
              >
                {t("retrySave")}
              </Button>
            </>
          )}
        </p>
      </QuizResult>
    );
  }

  return (
    <QuizPlayer
      key={run}
      questions={questions}
      timePerQuestion={quiz.time_per_question ?? null}
      check={localCheck(quiz)}
      onFinish={finish}
    />
  );
}

/** `/ustoz/testlar/[id]/oynash`. */
export function QuizPlayView({ quizId }: { quizId: string }) {
  const t = useTranslations("quizzes.play");
  const quiz = useQuery(quizQueries.detail(quizId));

  return (
    <div className={`${PAGE_STACK} mx-auto w-full max-w-3xl`}>
      <PageHeader
        title={quiz.data?.title ?? t("loadingTitle")}
        description={quiz.data?.description}
      />
      {quiz.isPending ? (
        <div className="flex flex-col gap-4" aria-busy aria-label={t("loading")}>
          <Skeleton className="h-6 rounded-md" />
          <Skeleton className="h-40 rounded-xl" />
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
        <PlaySession quiz={quiz.data} />
      )}
    </div>
  );
}
