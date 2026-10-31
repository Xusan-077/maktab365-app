"use client";

import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { PageEntry } from "@/lib/books/api";
import type { EntryFilters } from "@/lib/books/entries";
import { bookQueries } from "@/lib/books/queries";

/** «Mening yozuvlarim» ro'yxati (kirgan foydalanuvchi): sahifalab yuklanadi, "Yana" tugmasi bilan. */
export function useEntries(filters: EntryFilters) {
  const { signedIn } = useAuth();
  const query = useInfiniteQuery({ ...bookQueries.entries(filters), enabled: signedIn });
  const entries = useMemo<PageEntry[]>(
    () => query.data?.pages.flatMap((page) => page.results) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.count ?? 0;
  return { ...query, entries, total };
}

/** Yozuvi bor kitoblar (filtr ro'yxati). */
export function useEntryBooks() {
  const { signedIn } = useAuth();
  return useQuery({ ...bookQueries.entryBooks(), enabled: signedIn });
}
