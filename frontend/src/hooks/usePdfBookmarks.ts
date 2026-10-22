"use client";

import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { pdfKeys, pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";

/**
 * Saqlangan PDF darsliklar. Kirgan foydalanuvchi uchun backend'da (idempotent PUT/DELETE), mehmon
 * uchun brauzerda (`pdf-guest.store`); kirishda mavjud guest merge birlashtiradi.
 */
export function usePdfBookmarks() {
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  const guest = usePdfGuestStore((state) => state.bookmarks);
  const account = useQuery({ ...pdfQueries.bookmarks(), enabled: signedIn });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const save = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) await getPdfBooksApi().addBookmark(id);
      else await getPdfBooksApi().removeBookmark(id);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: pdfKeys.bookmarks() }),
        queryClient.invalidateQueries({ queryKey: pdfKeys.library() }),
      ]),
  });
  const { mutate } = save;

  const savedIds = signedIn ? (account.data ?? []).map((row) => row.book.id) : guest;

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const setSaved = useCallback(
    (id: string, saved: boolean) => {
      if (signedIn) mutate({ id, saved });
      else usePdfGuestStore.getState().setBookmark(id, saved);
    },
    [signedIn, mutate],
  );

  return {
    /** Akkaunt ro'yxati hali yuklanmagan bo'lsa `false`: tugma holati noaniq. */
    ready: !signedIn || !account.isPending,
    isSaved,
    setSaved,
    pending: save.isPending,
    error: save.error,
  };
}
