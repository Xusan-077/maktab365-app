"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sanitizeAnnotations,
  sortAnnotations,
  upsertAnnotation,
  type Annotation,
} from "@/lib/pdf/annotations";
import { retryUnlessClientError } from "@/lib/api/retry";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { usePdfAnnotationsGuestStore } from "@/stores/pdf-annotations-guest.store";
import { useAuth } from "./useAuth";

const key = (bookId: string) => ["pdf-annotations", bookId] as const;

/**
 * Kitobdagi belgilar: kirgan foydalanuvchida server (optimistic yangilanish, xatoda qaytariladi),
 * mehmonda shu brauzerning `localStorage`i. Kirgach mehmon belgilari `merge-guest-data/` bilan ko'chadi.
 */
export function usePdfAnnotations(bookId: string) {
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  const guestItems = usePdfAnnotationsGuestStore((state) => state.items);

  useEffect(() => {
    void usePdfAnnotationsGuestStore.persist.rehydrate();
  }, []);

  const account = useQuery({
    queryKey: key(bookId),
    queryFn: async () => sanitizeAnnotations(await getPdfBooksApi().listAnnotations(bookId)),
    enabled: signedIn,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });

  const items = useMemo(
    () =>
      sortAnnotations(
        signedIn ? (account.data ?? []) : guestItems.filter((item) => item.pdf_book_id === bookId),
      ),
    [signedIn, account.data, guestItems, bookId],
  );

  const saveRemote = useMutation({
    mutationFn: (annotation: Annotation) => getPdfBooksApi().saveAnnotation(annotation),
    onMutate: async (annotation) => {
      await queryClient.cancelQueries({ queryKey: key(bookId) });
      const previous = queryClient.getQueryData<Annotation[]>(key(bookId));
      queryClient.setQueryData<Annotation[]>(key(bookId), (list = []) =>
        upsertAnnotation(list, annotation),
      );
      return { previous };
    },
    onError: (_error, _annotation, context) =>
      queryClient.setQueryData(key(bookId), context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key(bookId) }),
  });

  const removeRemote = useMutation({
    mutationFn: (id: string) => getPdfBooksApi().deleteAnnotation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key(bookId) });
      const previous = queryClient.getQueryData<Annotation[]>(key(bookId));
      queryClient.setQueryData<Annotation[]>(key(bookId), (list = []) =>
        list.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => queryClient.setQueryData(key(bookId), context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key(bookId) }),
  });

  const save = useCallback(
    (annotation: Annotation) => {
      if (signedIn) saveRemote.mutate(annotation);
      else usePdfAnnotationsGuestStore.getState().save(annotation);
    },
    [signedIn, saveRemote],
  );
  const remove = useCallback(
    (id: string) => {
      if (signedIn) removeRemote.mutate(id);
      else usePdfAnnotationsGuestStore.getState().remove(id);
    },
    [signedIn, removeRemote],
  );

  return { items, save, remove, failed: saveRemote.isError || removeRemote.isError };
}
