"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/types";
import { newQuizValues, quizToFormValues } from "@/lib/quizzes/form";
import { quizQueries } from "@/lib/quizzes/queries";
import { QuizForm } from "./QuizForm";

/** `/ustoz/testlar/yangi` (id yo'q) va `/ustoz/testlar/[id]/tahrirlash`. */
export function QuizFormView({ quizId }: { quizId?: string }) {
  const t = useTranslations("quizzes.form");
  const quiz = useQuery({ ...quizQueries.detail(quizId ?? ""), enabled: Boolean(quizId) });
  const initial = useMemo(
    () => (quiz.data ? quizToFormValues(quiz.data) : newQuizValues()),
    [quiz.data],
  );

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t(quizId ? "editTitle" : "newTitle")} description={t("lead")} />
      {quizId && quiz.isPending ? (
        <div className="flex flex-col gap-4" aria-busy aria-label={t("loading")}>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : quizId && quiz.isError ? (
        <ErrorState
          variant={
            quiz.error instanceof ApiError && quiz.error.status === 404 ? "notFound" : "error"
          }
          standalone={false}
          onRetry={() => quiz.refetch()}
        />
      ) : (
        // `key` — boshqa test ochilganda forma boshidan qurilsin.
        <QuizForm key={quizId ?? "new"} initial={initial} quizId={quizId} />
      )}
    </div>
  );
}
