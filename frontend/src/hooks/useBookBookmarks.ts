"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/lib/api/retry";
import { getMyBooksApi, type Bookmark } from "@/lib/books/api";
import { bookKeys, bookQueries } from "@/lib/books/queries";
import { useBookGuestStore } from "@/stores/book-guest.store";
import { useAuth } from "./useAuth";

const NO_PAGES: number[] = [];

/**
 * Kitobdagi xatcho'plar (bet raqamlari, o'sish tartibida). Kirgan foydalanuvchi — backend
 * (optimistic qo'shish/olib tashlash, xatoda qaytariladi), mehmon — brauzer.
 */
export function useBookBookmarks(bookId: string) {
  const { status, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const guestPages = useBookGuestStore((state) => state.bookmarks[bookId]);
  const toggleGuest = useBookGuestStore((state) => state.toggleBookmark);
  const account = useQuery({
    ...bookQueries.bookmarks(bookId),
    enabled: signedIn,
    retry: retryUnlessClientError,
  });
  const key = bookKeys.bookmarks(bookId);

  const mutation = useMutation({
    mutationFn: async ({ page, on }: { page: number; on: boolean }) => {
      if (on) await getMyBooksApi().addBookmark(bookId, page);
      else await getMyBooksApi().removeBookmark(bookId, page);
    },
    onMutate: async ({ page, on }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Bookmark[]>(key);
      queryClient.setQueryData<Bookmark[]>(key, (old = []) =>
        on
          ? [
              ...old.filter((item) => item.page !== page),
              { id: `pending-${page}`, page, created_at: new Date().toISOString() },
            ].sort((a, b) => a.page - b.page)
          : old.filter((item) => item.page !== page),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  const accountPages = useMemo(
    () => account.data?.map((item) => item.page) ?? NO_PAGES,
    [account.data],
  );
  const pages = signedIn ? accountPages : (guestPages ?? NO_PAGES);
  const { mutate } = mutation;

  const toggle = useCallback(
    (page: number) => {
      if (status === "unauthenticated") toggleGuest(bookId, page);
      else if (signedIn) mutate({ page, on: !accountPages.includes(page) });
    },
    [status, signedIn, toggleGuest, bookId, mutate, accountPages],
  );

  return { pages, toggle, isBookmarked: (page: number) => pages.includes(page) };
}
