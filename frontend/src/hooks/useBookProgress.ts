"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/lib/api/retry";
import { getMyBooksApi, type BookProgress } from "@/lib/books/api";
import { bookKeys, bookQueries } from "@/lib/books/queries";
import { useBookGuestStore } from "@/stores/book-guest.store";
import { useAuth } from "./useAuth";

/** Akkaunt yozuvi serverga shuncha kechikish bilan yuboriladi (varaqlashda har bosishda emas). */
const SAVE_DEBOUNCE_MS = 800;

/**
 * Kitobda oxirgi ochilgan bet. Kirgan foydalanuvchi uchun backend'da (idempotent PUT, debounce),
 * mehmon uchun brauzerda (`book-guest.store`). Server xatosi o'qishni to'xtatmaydi.
 *
 * `lastPage` — saqlangan bet (`null` — hali o'qilmagan yoki hali aniqlanmagan, `ready` bilan farqlang).
 */
export function useBookProgress(bookId: string, enabled = true) {
  const { status, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const guestPage = useBookGuestStore((state) => state.positions[bookId]);
  const setGuestPosition = useBookGuestStore((state) => state.setPosition);
  const account = useQuery({
    ...bookQueries.progress(bookId),
    enabled: signedIn && enabled,
    retry: retryUnlessClientError,
  });

  useEffect(() => {
    void useBookGuestStore.persist.rehydrate();
  }, []);

  const mutation = useMutation({
    mutationFn: ({ page, at }: { page: number; at: string }) =>
      getMyBooksApi().saveProgress(bookId, page, at),
    onMutate: ({ page, at }) => {
      const previous = queryClient.getQueryData<BookProgress | null>(bookKeys.progress(bookId));
      queryClient.setQueryData<BookProgress | null>(bookKeys.progress(bookId), (old) =>
        old ? { ...old, last_page: page, updated_at: at } : old,
      );
      return { previous };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(bookKeys.progress(bookId), saved);
      void queryClient.invalidateQueries({ queryKey: bookKeys.progressList() });
    },
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ page: number; at: string } | null>(null);
  const { mutate } = mutation;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) mutate(next);
  }, [mutate]);

  const save = useCallback(
    (page: number) => {
      if (status === "unauthenticated") {
        setGuestPosition(bookId, page);
        return;
      }
      if (!signedIn) return;
      pending.current = { page, at: new Date().toISOString() };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [status, signedIn, setGuestPosition, bookId, flush],
  );

  // Sahifa yopilganda yoki tab yashirilganda kutayotgan yozuv yuboriladi.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const ready = status === "unauthenticated" || (signedIn && !account.isPending);
  const lastPage = signedIn ? (account.data?.last_page ?? null) : (guestPage ?? null);

  return { lastPage, ready, save };
}
