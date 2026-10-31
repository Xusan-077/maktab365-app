import { queryOptions } from "@tanstack/react-query";
import { getQuizzesApi, type QuizListParams } from "./api";

export const quizKeys = {
  root: ["quizzes"] as const,
  lists: () => ["quizzes", "list"] as const,
  list: (params: QuizListParams) => ["quizzes", "list", params] as const,
  detail: (id: string) => ["quizzes", "detail", id] as const,
  attempts: (id: string) => ["quizzes", "attempts", id] as const,
  categories: () => ["quizzes", "categories"] as const,
  publicQuiz: (id: string) => ["quizzes", "public", id] as const,
};

export const quizQueries = {
  list: (params: QuizListParams) =>
    queryOptions({
      queryKey: quizKeys.list(params),
      queryFn: () => getQuizzesApi().list(params),
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: quizKeys.detail(id),
      queryFn: () => getQuizzesApi().get(id),
      staleTime: 30_000,
    }),
  attempts: (id: string) =>
    queryOptions({
      queryKey: quizKeys.attempts(id),
      queryFn: () => getQuizzesApi().attempts(id),
    }),
  categories: () =>
    queryOptions({
      queryKey: quizKeys.categories(),
      queryFn: () => getQuizzesApi().categories(),
      staleTime: 5 * 60_000,
    }),
  publicQuiz: (id: string) =>
    queryOptions({
      queryKey: quizKeys.publicQuiz(id),
      queryFn: () => getQuizzesApi().publicQuiz(id),
      staleTime: 60_000,
      retry: false,
    }),
};
