"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnnotationQueue } from "@/lib/books/annotation-sync";
import { groupByPage, parseAnnotations } from "@/lib/books/annotations";
import { bookQueries } from "@/lib/books/queries";
import { useBookAnnotationsStore } from "@/stores/book-annotations.store";
import { useAuth } from "./useAuth";

/** Joriy bet va qo'shnilari: varaqlashda chizma "yuklanmoqda" bo'lib turmasin. */
export const ANNOTATION_PRELOAD_RADIUS = 1;

export function annotationWindow(page: number, total: number): number[] {
  const pages: number[] = [];
  for (let n = page - ANNOTATION_PRELOAD_RADIUS; n <= page + ANNOTATION_PRELOAD_RADIUS; n += 1) {
    if (n >= 1 && n <= total) pages.push(n);
  }
  return pages;
}

/**
 * Joriy bet va qo'shni betlar annotatsiyalarini yuklab, store'ga qo'yadi. Hali yuborilmagan mahalliy
 * o'zgarish (navbatda) server nusxasidan ustun turadi. Mehmon uchun yuklash yo'q: ro'yxat bo'sh.
 */
export function useAnnotationLoader(bookId: string, page: number, total: number) {
  const { sessionUser, signedIn } = useAuth();
  const pages = annotationWindow(page, total);
  const query = useQuery({ ...bookQueries.annotations(bookId, pages), enabled: signedIn });
  const loadedHere = useBookAnnotationsStore((state) => Boolean(state.pages[page]));
  const hydrate = useBookAnnotationsStore((state) => state.hydrate);
  const userId = sessionUser?.id ?? null;

  useEffect(() => {
    if (!query.data || !userId) return;
    const grouped = groupByPage(query.data);
    for (const number of pages) {
      const queued = getAnnotationQueue(userId).find("annotations", bookId, number);
      const items = queued
        ? parseAnnotations(queued.items)
        : parseAnnotations(grouped.get(number) ?? []);
      hydrate(number, items);
    }
    // `pages` — `page`/`total` dan hisoblanadi; ular o'zgarsa query ham o'zgaradi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, userId, bookId, hydrate]);

  return {
    /** Joriy betning chizmalari tayyor (mehmonda doim). */
    ready: !signedIn || loadedHere,
    error: signedIn && query.isError,
    retry: () => void query.refetch(),
  };
}
