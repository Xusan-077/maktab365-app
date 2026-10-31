"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { isTempQuiz, useDeleteQuiz, useDuplicateQuiz } from "@/hooks/useQuizMutations";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useToast } from "@/hooks/useToast";
import { Link } from "@/lib/i18n/navigation";
import { quizQueries } from "@/lib/quizzes/queries";
import type { QuizSummary } from "@/lib/quizzes/types";
import { quizPaths } from "@/lib/utils/routes";
import { DeleteQuizDialog } from "./DeleteQuizDialog";
import { QuizCard } from "./QuizCard";
import { QuizFilters } from "./QuizFilters";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

function NewQuizLink() {
  const t = useTranslations("quizzes.list");
  return (
    <Link href={quizPaths.create()} className={buttonVariants()}>
      <Plus className="size-4" aria-hidden />
      {t("new")}
    </Link>
  );
}

/** "Mening testlarim": kartalar, kategoriya filtri, qidiruv. */
export function QuizzesView() {
  const t = useTranslations("quizzes");
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [toDelete, setToDelete] = useState<QuizSummary | null>(null);
  const q = useDebouncedValue(search.trim(), 300);

  const list = useQuery(quizQueries.list({ q, category }));
  const categories = useQuery(quizQueries.categories());
  const remove = useDeleteQuiz();
  const duplicate = useDuplicateQuiz((title) => t("card.copyTitle", { title }));

  const filtered = q !== "" || category !== "";
  const quizzes = list.data;

  function confirmDelete() {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => toast({ variant: "success", title: t("delete.done") }),
      onError: () => toast({ variant: "error", title: t("delete.failed") }),
    });
    setToDelete(null);
  }

  function copy(quiz: QuizSummary) {
    duplicate.mutate(quiz, {
      onSuccess: () => toast({ variant: "success", title: t("card.duplicated") }),
      onError: () => toast({ variant: "error", title: t("card.duplicateFailed") }),
    });
  }

  return (
    <div className={PAGE_STACK}>
      <PageHeader
        title={t("list.title")}
        description={t("list.description")}
        action={quizzes && quizzes.length > 0 ? <NewQuizLink /> : undefined}
      />

      {(!quizzes || quizzes.length > 0 || filtered) && (
        <QuizFilters
          search={search}
          onSearchChange={setSearch}
          categories={categories.data ?? []}
          category={category}
          onCategoryChange={setCategory}
        />
      )}

      {list.isPending ? (
        <div className={GRID} aria-busy aria-label={t("list.loading")}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !list.data ? (
        // Yangilash xato bersa ham, avvalgi kartalar (masalan, o'chirish rollback'i) yo'qolmaydi.
        <ErrorState variant="error" standalone={false} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX}>{t("list.noResults")}</EmptyState>
        ) : (
          <EmptyState icon={ClipboardList} action={<NewQuizLink />}>
            <strong className="text-foreground block text-base">{t("list.emptyTitle")}</strong>
            {t("list.emptyHint")}
          </EmptyState>
        )
      ) : (
        <ul className={GRID}>
          {list.data.map((quiz) => (
            <li key={quiz.id} className="flex">
              <QuizCard
                quiz={quiz}
                pending={isTempQuiz(quiz.id)}
                onDuplicate={copy}
                onDelete={setToDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <DeleteQuizDialog
        title={toDelete?.title ?? null}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
