"use client";

import { useQuery } from "@tanstack/react-query";
import { History, Play, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/types";
import type { Locale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/navigation";
import { formatClock, percentOf } from "@/lib/quizzes/play";
import { quizQueries } from "@/lib/quizzes/queries";
import type { QuizAttempt } from "@/lib/quizzes/types";
import { formatDate } from "@/lib/utils/format-date";
import { quizPaths } from "@/lib/utils/routes";

/** Eng yuqori foizli urinishning `id`si (teng bo'lsa — yangisi). */
export function bestAttemptId(attempts: QuizAttempt[]): string | null {
  let best: QuizAttempt | null = null;
  for (const attempt of attempts) {
    if (!best || percentOf(attempt.score, attempt.total) > percentOf(best.score, best.total)) {
      best = attempt;
    }
  }
  return best?.id ?? null;
}

/** `/ustoz/testlar/[id]/natijalar`: o'ynalgan urinishlar tarixi. */
export function QuizAttemptsView({ quizId }: { quizId: string }) {
  const t = useTranslations("quizzes.results");
  const locale = useLocale() as Locale;
  const quiz = useQuery(quizQueries.detail(quizId));
  const attempts = useQuery(quizQueries.attempts(quizId));
  const bestId = attempts.data ? bestAttemptId(attempts.data) : null;
  const best = attempts.data?.find((attempt) => attempt.id === bestId);

  const playLink = (
    <Link href={quizPaths.play(quizId)} className={buttonVariants()}>
      <Play className="size-4" aria-hidden />
      {t("play")}
    </Link>
  );

  return (
    <div className={PAGE_STACK}>
      <PageHeader
        title={t("title")}
        description={quiz.data?.title}
        action={attempts.data && attempts.data.length > 0 ? playLink : undefined}
      />

      {attempts.isPending ? (
        <div className="flex flex-col gap-3" aria-busy aria-label={t("loading")}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : attempts.isError ? (
        <ErrorState
          variant={
            attempts.error instanceof ApiError && attempts.error.status === 404
              ? "notFound"
              : "error"
          }
          standalone={false}
          onRetry={() => attempts.refetch()}
        />
      ) : attempts.data.length === 0 ? (
        <EmptyState icon={History} action={playLink}>
          {t("empty")}
        </EmptyState>
      ) : (
        <>
          {best && (
            <Card className="bg-accent-soft flex items-center gap-3">
              <Trophy className="text-accent-soft-foreground size-6" aria-hidden />
              <p className="font-semibold">
                {t("best", {
                  score: best.score,
                  total: best.total,
                  percent: percentOf(best.score, best.total),
                })}
              </p>
            </Card>
          )}
          <ul className="flex flex-col gap-3">
            {attempts.data.map((attempt) => (
              <li key={attempt.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold tabular-nums">
                      {attempt.score} / {attempt.total} · {percentOf(attempt.score, attempt.total)}%
                    </p>
                    <p className="text-muted text-sm">
                      {formatDate(attempt.created_at, locale, "dateTime")} ·{" "}
                      {t("time", { time: formatClock(attempt.time_spent) })}
                    </p>
                  </div>
                  {attempt.id === bestId && <Badge variant="accent">{t("bestBadge")}</Badge>}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
