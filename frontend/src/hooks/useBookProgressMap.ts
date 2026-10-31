"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/lib/api/retry";
import { bookQueries } from "@/lib/books/queries";
import { useBookGuestStore } from "@/stores/book-guest.store";
import { useAuth } from "./useAuth";

/**
 * Barcha kitoblar bo'yicha oxirgi bet: `kitob id → bet`. Kirgan — bitta so'rov (hamma kartalar
 * uchun umumiy kesh), mehmon — brauzer xotirasi.
 */
export function useBookProgressMap(): ReadonlyMap<string, number> {
  const { signedIn } = useAuth();
  const account = useQuery({
    ...bookQueries.progressList(),
    enabled: signedIn,
    retry: retryUnlessClientError,
  });
  const guest = useBookGuestStore((state) => state.positions);

  useEffect(() => {
    if (!useBookGuestStore.persist.hasHydrated()) void useBookGuestStore.persist.rehydrate();
  }, []);

  return useMemo(
    () =>
      signedIn
        ? new Map((account.data ?? []).map((row) => [row.book_id, row.last_page]))
        : new Map(Object.entries(guest)),
    [signedIn, account.data, guest],
  );
}
