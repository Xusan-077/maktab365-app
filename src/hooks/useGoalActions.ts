import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import type { UpdateGoalInput } from "@/types/goal";

/** Maqsad qo'shish, yangilash va o'chirish; har biridan keyin ro'yxat qayta yuklanadi. */
export function useGoalActions() {
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: queryKeys.goals() });
  return {
    create: useMutation({
      mutationFn: (title: string) => getApi().createGoal(title),
      onSettled,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: UpdateGoalInput & { id: string }) =>
        getApi().updateGoal(id, input),
      onSettled,
    }),
    remove: useMutation({
      mutationFn: (id: string) => getApi().deleteGoal(id),
      onSettled,
    }),
  };
}
