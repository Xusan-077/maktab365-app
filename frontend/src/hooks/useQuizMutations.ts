"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getQuizzesApi } from "@/lib/quizzes/api";
import { quizKeys } from "@/lib/quizzes/queries";
import type { QuizInput, QuizSummary } from "@/lib/quizzes/types";

const TEMP_PREFIX = "temp-";

/** Optimistik qo'shilgan (hali serverda yo'q) karta. */
export const isTempQuiz = (id: string) => id.startsWith(TEMP_PREFIX);

type ListSnapshot = [readonly unknown[], QuizSummary[] | undefined][];

/** Barcha ro'yxat keshlariga (filtr variantlari) bir xil o'zgarishni qo'llaydi va eskisini qaytaradi. */
async function patchLists(
  client: QueryClient,
  update: (items: QuizSummary[]) => QuizSummary[],
): Promise<ListSnapshot> {
  await client.cancelQueries({ queryKey: quizKeys.lists() });
  const previous = client.getQueriesData<QuizSummary[]>({ queryKey: quizKeys.lists() });
  client.setQueriesData<QuizSummary[]>({ queryKey: quizKeys.lists() }, (items) =>
    items ? update(items) : items,
  );
  return previous;
}

function restore(client: QueryClient, snapshot: ListSnapshot | undefined) {
  snapshot?.forEach(([key, data]) => client.setQueryData(key, data));
}

/** O'chirish: karta darrov yo'qoladi, xatoda qaytadi. */
export function useDeleteQuiz() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getQuizzesApi().remove(id),
    onMutate: async (id) => ({
      previous: await patchLists(client, (items) => items.filter((item) => item.id !== id)),
    }),
    onError: (_error, _id, context) => restore(client, context?.previous),
    onSettled: (_data, _error, id) => {
      client.removeQueries({ queryKey: quizKeys.detail(id) });
      client.removeQueries({ queryKey: quizKeys.attempts(id) });
      return client.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

/** Nusxalash: vaqtinchalik karta ro'yxat boshida, serverdan javob kelgach haqiqiysi bilan almashadi. */
export function useDuplicateQuiz(copyTitle: (title: string) => string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (source: QuizSummary) => getQuizzesApi().duplicate(source.id),
    onMutate: async (source) => {
      const now = new Date().toISOString();
      const temp: QuizSummary = {
        ...source,
        id: `${TEMP_PREFIX}${source.id}`,
        title: copyTitle(source.title),
        visibility: "private",
        attempts_count: 0,
        best_percent: null,
        created_at: now,
        updated_at: now,
      };
      return { previous: await patchLists(client, (items) => [temp, ...items]) };
    },
    onError: (_error, _source, context) => restore(client, context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey: quizKeys.lists() }),
  });
}

/** Yaratish yoki yangilash (`id` bo'lsa). */
export function useSaveQuiz(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: QuizInput) =>
      id ? getQuizzesApi().update(id, input) : getQuizzesApi().create(input),
    onSuccess: (quiz) => {
      client.setQueryData(quizKeys.detail(quiz.id), quiz);
      return client.invalidateQueries({ queryKey: quizKeys.lists() });
    },
  });
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => getQuizzesApi().createCategory(name),
    onSuccess: () => client.invalidateQueries({ queryKey: quizKeys.categories() }),
  });
}

/** Natijani saqlaydi va tarix hamda ro'yxatdagi "eng yaxshi natija" ni yangilaydi. */
export function useSaveAttempt(quizId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<ReturnType<typeof getQuizzesApi>["createAttempt"]>[1]) =>
      getQuizzesApi().createAttempt(quizId, input),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: quizKeys.attempts(quizId) }),
        client.invalidateQueries({ queryKey: quizKeys.lists() }),
      ]),
  });
}
