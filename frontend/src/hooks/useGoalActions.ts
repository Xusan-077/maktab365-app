import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import type { StudyGoal, UpdateGoalInput } from "@/types/goal";

type GoalsSnapshot = { previous: StudyGoal[] | undefined };

/**
 * Optimistic o'zgarish: ro'yxat darhol yangilanadi, xatoda oldingi holatga qaytariladi (rollback),
 * oxirida server holati bilan solishtiriladi.
 */
async function applyOptimistic(
  queryClient: QueryClient,
  change: (goals: StudyGoal[]) => StudyGoal[],
): Promise<GoalsSnapshot> {
  await queryClient.cancelQueries({ queryKey: queryKeys.goals() });
  const previous = queryClient.getQueryData<StudyGoal[]>(queryKeys.goals());
  if (previous) queryClient.setQueryData<StudyGoal[]>(queryKeys.goals(), change(previous));
  return { previous };
}

export function rollbackGoals(queryClient: QueryClient, snapshot: GoalsSnapshot | undefined) {
  if (snapshot?.previous) queryClient.setQueryData(queryKeys.goals(), snapshot.previous);
}

/** Maqsad qo'shish, yangilash va o'chirish: optimistic, xatoda rollback. */
export function useGoalActions() {
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: queryKeys.goals() });
  const onError = (_error: unknown, _vars: unknown, snapshot: GoalsSnapshot | undefined) =>
    rollbackGoals(queryClient, snapshot);

  return {
    create: useMutation({
      mutationFn: (title: string) => getApi().createGoal(title),
      onMutate: (title) =>
        applyOptimistic(queryClient, (goals) => [
          {
            id: `pending-${crypto.randomUUID()}`,
            userId: "",
            title: title.trim(),
            done: false,
            createdAt: new Date().toISOString(),
          },
          ...goals,
        ]),
      onError,
      onSettled,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: UpdateGoalInput & { id: string }) =>
        getApi().updateGoal(id, input),
      onMutate: ({ id, ...input }) =>
        applyOptimistic(queryClient, (goals) =>
          goals.map((goal) =>
            goal.id === id
              ? {
                  ...goal,
                  ...(input.title !== undefined && { title: input.title.trim() }),
                  ...(input.done !== undefined && { done: input.done }),
                }
              : goal,
          ),
        ),
      onError,
      onSettled,
    }),
    remove: useMutation({
      mutationFn: (id: string) => getApi().deleteGoal(id),
      onMutate: (id) => applyOptimistic(queryClient, (goals) => goals.filter((g) => g.id !== id)),
      onError,
      onSettled,
    }),
  };
}
