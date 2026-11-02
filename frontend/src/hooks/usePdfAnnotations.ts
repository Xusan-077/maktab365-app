"use client";

import { useCallback, useEffect, useMemo } from "react";
import { sortAnnotations, type Annotation } from "@/lib/pdf/annotations";
import { usePdfAnnotationsGuestStore } from "@/stores/pdf-annotations-guest.store";

/**
 * Kitobdagi belgilar va eslatmalar — **faqat shu qurilmada** (`localStorage`), kirgan foydalanuvchida
 * ham serverga yuborilmaydi. `remove` o'chirilgan belgini qaytaradi (bekor qilish uchun `restore`).
 */
export function usePdfAnnotations(bookId: string) {
  const all = usePdfAnnotationsGuestStore((state) => state.items);

  useEffect(() => {
    void usePdfAnnotationsGuestStore.persist.rehydrate();
  }, []);

  const items = useMemo(
    () => sortAnnotations(all.filter((item) => item.pdf_book_id === bookId)),
    [all, bookId],
  );

  const save = useCallback((annotation: Annotation) => {
    usePdfAnnotationsGuestStore.getState().save(annotation);
  }, []);

  const remove = useCallback((id: string): Annotation | null => {
    const store = usePdfAnnotationsGuestStore.getState();
    const removed = store.items.find((item) => item.id === id) ?? null;
    store.remove(id);
    return removed;
  }, []);

  /** Shu kitobdagi barcha belgilar o'chiriladi; o'chirilganlar qaytariladi. */
  const removeAll = useCallback((): Annotation[] => {
    const store = usePdfAnnotationsGuestStore.getState();
    const removed = store.items.filter((item) => item.pdf_book_id === bookId);
    store.removeBook(bookId);
    return removed;
  }, [bookId]);

  /** O'chirilganlarni qaytarish («Qaytarish» tugmasi). */
  const restore = useCallback((annotations: readonly Annotation[]) => {
    const store = usePdfAnnotationsGuestStore.getState();
    for (const annotation of annotations) store.save(annotation);
  }, []);

  return { items, save, remove, removeAll, restore };
}
