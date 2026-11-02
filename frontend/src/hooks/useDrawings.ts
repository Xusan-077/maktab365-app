"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseAnnotations, toItem } from "@/lib/books/annotations";
import { GuestDrawings } from "@/lib/books/guest-drawings";
import { useBookAnnotationsStore } from "@/stores/book-annotations.store";

/** Chizmalar egasi: qurilmaning o'zi (akkauntga bog'lanmaydi). */
export const LOCAL_OWNER = "local";

/**
 * O'qish oynasidagi chizmalar (darslik ham, Kutubxona kitobi ham) — **faqat shu qurilmada**
 * (`GuestDrawings`: IndexedDB, bo'lmasa localStorage). Kirgan foydalanuvchida ham serverga
 * yuborilmaydi. Kitob ochilganda bir marta o'qiladi, keyin har o'zgarish darhol yoziladi.
 */
export function useDrawings(bookId: string) {
  const storage = useMemo(() => new GuestDrawings(bookId), [bookId]);
  const attach = useBookAnnotationsStore((state) => state.attach);
  const hydrate = useBookAnnotationsStore((state) => state.hydrate);
  /** Qurilmadan o'qilgan kitob (o'qilmaguncha chizish yopiq — ustidan yozilmasin). */
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    attach(bookId, LOCAL_OWNER);
    let cancelled = false;
    void storage.load().then((stored) => {
      if (cancelled || useBookAnnotationsStore.getState().bookId !== bookId) return;
      for (const [number, items] of Object.entries(stored)) {
        hydrate(Number(number), parseAnnotations(items));
      }
      setLoaded(bookId);
    });
    let lastSeq = useBookAnnotationsStore.getState().lastChange?.seq ?? 0;
    const unsubscribe = useBookAnnotationsStore.subscribe((state) => {
      const change = state.lastChange;
      if (!change || change.seq === lastSeq || change.bookId !== bookId) return;
      lastSeq = change.seq;
      void storage.savePage(change.page, change.items.map(toItem)).catch(() => undefined);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [attach, hydrate, storage, bookId]);

  /** Kitobdagi barcha chizmalarni o'chirish (qurilmadan ham). */
  const clearAll = useCallback(async () => {
    useBookAnnotationsStore.getState().clearAll();
    await storage.clear().catch(() => undefined);
  }, [storage]);

  return {
    /** Chizmalar qurilmadan o'qildi. */
    ready: loaded === bookId,
    clearAll,
  };
}
