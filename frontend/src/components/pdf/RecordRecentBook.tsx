"use client";

import { useEffect } from "react";
import type { RecentBook } from "@/lib/pdf/recent";
import { useRecentBooksStore } from "@/stores/recent-books.store";

/** Ko'rinmas: kitob sahifasi yoki o'qish oynasi ochilganda kitobni "oxirgi ko'rilganlar"ga yozadi. */
export function RecordRecentBook({ book }: { book: RecentBook | undefined }) {
  const id = book?.id;
  useEffect(() => {
    if (!book) return;
    void (async () => {
      await useRecentBooksStore.persist.rehydrate();
      useRecentBooksStore.getState().add(book);
    })();
    // Faqat kitob almashganda yoziladi (ob'ekt identifikatori har renderda o'zgarishi mumkin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}
