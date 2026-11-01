"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyBooksApi,
  type AnswerAttemptDetail,
  type AnswerAttemptSummary,
  type AnswerSheet,
} from "@/lib/books/api";
import { bookKeys, bookQueries } from "@/lib/books/queries";
import { answerMap, sheetProgress, withAnswer } from "@/lib/books/test-mode";

interface AnswerVars {
  page: number;
  question: number;
  answer: string;
}

/**
 * Test kitobning javoblar varag'i: savollar (kalitsiz), mening javoblarim (optimistik, xatoda
 * qaytariladi), tekshirish va urinishlar tarixi. `enabled=false` bo'lsa (mehmon yoki boshqa tur) so'rov yo'q.
 */
export function useTestSheet(bookId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const sheetKey = bookKeys.testSheet(bookId);
  const sheet = useQuery({ ...bookQueries.testSheet(bookId), enabled });
  const attempts = useQuery({ ...bookQueries.testAttempts(bookId), enabled });

  const answerMutation = useMutation({
    mutationFn: (vars: AnswerVars) => getMyBooksApi().saveTestAnswer(bookId, vars),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: sheetKey });
      const previous = queryClient.getQueryData<AnswerSheet>(sheetKey);
      queryClient.setQueryData<AnswerSheet>(sheetKey, (old) =>
        old ? withAnswer(old, vars.page, vars.question, vars.answer) : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(sheetKey, context?.previous),
  });

  const checkMutation = useMutation({
    mutationFn: () => getMyBooksApi().checkTest(bookId),
    onSuccess: (attempt: AnswerAttemptDetail) => {
      queryClient.setQueryData(bookKeys.testAttempt(bookId, attempt.id), attempt);
      queryClient.setQueryData<AnswerAttemptSummary[]>(
        bookKeys.testAttempts(bookId),
        (old = []) => [
          {
            id: attempt.id,
            created_at: attempt.created_at,
            score: attempt.score,
            total: attempt.total,
          },
          ...old,
        ],
      );
    },
  });

  const data = sheet.data;
  const answers = useMemo(() => (data ? answerMap(data) : new Map<string, string>()), [data]);
  const progress = useMemo(() => (data ? sheetProgress(data) : { answered: 0, total: 0 }), [data]);
  const { mutate } = answerMutation;
  const setAnswer = useCallback(
    (page: number, question: number, answer: string) => mutate({ page, question, answer }),
    [mutate],
  );

  return {
    sheet: data,
    loading: enabled && sheet.isPending,
    error: sheet.isError,
    reload: () => void sheet.refetch(),
    answers,
    progress,
    setAnswer,
    answerFailed: answerMutation.isError,
    check: checkMutation.mutateAsync,
    checking: checkMutation.isPending,
    checkError: checkMutation.error,
    attempts: attempts.data ?? [],
    attemptsLoading: enabled && attempts.isPending,
  };
}
