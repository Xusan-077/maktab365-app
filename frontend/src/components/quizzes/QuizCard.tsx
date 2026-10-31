"use client";

import { Copy, Globe, History, Lock, Pencil, Play, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Link } from "@/lib/i18n/navigation";
import type { QuizSummary } from "@/lib/quizzes/types";
import { formatDate } from "@/lib/utils/format-date";
import { quizPaths } from "@/lib/utils/routes";
import type { Locale } from "@/lib/i18n/config";
import { QuizCover } from "./QuizCover";
import { ShareLinkButton } from "./ShareLinkButton";

interface Props {
  quiz: QuizSummary;
  /** Optimistik qo'shilgan karta: harakatlar o'chiq. */
  pending: boolean;
  onDuplicate: (quiz: QuizSummary) => void;
  onDelete: (quiz: QuizSummary) => void;
}

export function QuizCard({ quiz, pending, onDuplicate, onDelete }: Props) {
  const t = useTranslations("quizzes.card");
  const locale = useLocale() as Locale;
  const isPublic = quiz.visibility === "public";

  return (
    <Card
      className="flex h-full w-full flex-col gap-3 overflow-hidden p-0"
      aria-busy={pending || undefined}
    >
      <QuizCover src={quiz.cover_url} />
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-balance break-words">{quiz.title}</CardTitle>
            <p className="text-muted mt-1 text-xs">
              {t("meta", { count: quiz.question_count })} ·{" "}
              {formatDate(quiz.updated_at, locale, "dayMonth")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quiz.category && <Badge variant="primary">{quiz.category.name}</Badge>}
          <Badge variant={isPublic ? "success" : "neutral"} className="gap-1">
            {isPublic ? (
              <Globe className="size-3" aria-hidden />
            ) : (
              <Lock className="size-3" aria-hidden />
            )}
            {t(isPublic ? "public" : "private")}
          </Badge>
        </div>

        <p className="text-muted text-sm">
          {quiz.best_percent === null ? t("noAttempts") : t("best", { percent: quiz.best_percent })}
        </p>

        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            href={quizPaths.play(quiz.id)}
            aria-disabled={pending}
            className={buttonVariants({ size: "sm" })}
          >
            <Play className="size-4" aria-hidden />
            {t("play")}
          </Link>
          <Link
            href={quizPaths.edit(quiz.id)}
            aria-disabled={pending}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Pencil className="size-4" aria-hidden />
            {t("edit")}
          </Link>
          <Link
            href={quizPaths.results(quiz.id)}
            aria-disabled={pending}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <History className="size-4" aria-hidden />
            {t("results")}
          </Link>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => onDuplicate(quiz)}
          >
            <Copy className="size-4" aria-hidden />
            {t("duplicate")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onDelete(quiz)}
            aria-label={t("deleteLabel", { title: quiz.title })}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
          {isPublic && !pending && <ShareLinkButton quizId={quiz.id} />}
        </div>
      </div>
    </Card>
  );
}
