"use client";

import { useEffect, useState } from "react";
import { isBookRead, usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import type { RecentBook } from "@/lib/pdf/recent";
import { useRecentBooksStore } from "@/stores/recent-books.store";

export interface ContinueBook {
  book: RecentBook;
  /** Oxirgi o'qilgan bet (1 dan). */
  page: number;
}

/**
 * "Davom ettirish": oxirgi ko'rilgan, boshlangan (2-betdan keyin) va hali tugatilmagan kitoblar.
 * Ma'lumot shu brauzerdan (mehmon ham); gidratsiyagacha `ready` false (SSR bilan mos).
 */
export function useContinueBooks(limit: number): { ready: boolean; items: ContinueBook[] } {
  const recent = useRecentBooksStore((state) => state.items);
  const progress = usePdfProgressMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void useRecentBooksStore.persist.rehydrate()?.then(() => setReady(true));
  }, []);

  const items = recent
    .filter((book) => {
      const entry = progress[book.id];
      return entry && entry.page > 1 && !isBookRead(entry, book.page_count);
    })
    .slice(0, limit)
    .map((book) => ({ book, page: progress[book.id].page }));

  return { ready, items };
}
