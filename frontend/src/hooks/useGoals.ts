"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Goal, GoalInput } from "@/lib/pdf-books/api";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { pdfKeys, pdfQueries } from "@/lib/pdf-books/queries";
import { useAuth } from "./useAuth";

interface Snapshot {
  previous: Goal[] | undefined;
}

/**
 * Shaxsiy rejalar. Har o'zgarish darhol ro'yxatda ko'rinadi (optimistic) va server rad etsa
 * qaytariladi; muvaffaqiyatda ro'yxat va bosh sahifa ko'rsatkichlari yangilanadi.
 */
export function useGoals() {
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ ...pdfQueries.goals(), enabled: signedIn });

  const apply = async (update: (goals: Goal[]) => Goal[]): Promise<Snapshot> => {
    await queryClient.cancelQueries({ queryKey: pdfKeys.goals() });
    const previous = queryClient.getQueryData<Goal[]>(pdfKeys.goals());
    queryClient.setQueryData<Goal[]>(pdfKeys.goals(), update(previous ?? []));
    return { previous };
  };
  const rollback = (_error: unknown, _vars: unknown, context: Snapshot | undefined) =>
    queryClient.setQueryData(pdfKeys.goals(), context?.previous);
  const settle = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: pdfKeys.goals() }),
      queryClient.invalidateQueries({ queryKey: pdfKeys.dashboard() }),
    ]);

  const create = useMutation({
    networkMode: "always",
    mutationFn: (input: GoalInput) => getPdfBooksApi().createGoal(input),
    onMutate: (input) =>
      apply((goals) => [
        {
          id: `pending-${crypto.randomUUID()}`,
          title: input.title,
          book: null,
          due_date: input.due_date ?? null,
          done: false,
          done_at: null,
          created_at: new Date().toISOString(),
        },
        ...goals,
      ]),
    onError: rollback,
    onSettled: settle,
  });

  const toggle = useMutation({
    networkMode: "always",
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      getPdfBooksApi().updateGoal(id, { done }),
    onMutate: ({ id, done }) =>
      apply((goals) =>
        goals.map((goal) =>
          goal.id === id
            ? { ...goal, done, done_at: done ? new Date().toISOString() : null }
            : goal,
        ),
      ),
    onError: rollback,
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: "always",
    mutationFn: (id: string) => getPdfBooksApi().deleteGoal(id),
    onMutate: (id) => apply((goals) => goals.filter((goal) => goal.id !== id)),
    onError: rollback,
    onSettled: settle,
  });

  return {
    goals: query.data ?? [],
    isPending: signedIn && query.isPending,
    isError: query.isError,
    create,
    toggle,
    remove,
  };
}
