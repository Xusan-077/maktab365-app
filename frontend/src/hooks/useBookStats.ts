"use client";

import { useEffect } from "react";
import { getPdfBooksApi } from "@/lib/pdf-books/api";

/** Sahifa shuncha vaqt ko'rinib tursa "o'qildi" deb sanaladi (tez varaqlash hisobga olinmaydi). */
export const PAGE_DWELL_MS = 2000;

/** Bir sessiyada bir xil hodisa qayta yuborilmaydi (qayta yuklash soni oshirmasin). */
function firstTime(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage yopiq: dedup yo'q, lekin baribir yuboriladi.
  }
  return true;
}

function send(
  bookId: string,
  event: Parameters<ReturnType<typeof getPdfBooksApi>["recordStat"]>[1],
) {
  void getPdfBooksApi()
    .recordStat(bookId, event)
    .catch(() => undefined);
}

/**
 * Anonim statistika: kitob ochilishi va (bir oz ko'rinib turgan) sahifalar. Faqat son yuboriladi,
 * shaxsiy ma'lumot va cookie yo'q; xato o'qishga ta'sir qilmaydi.
 */
export function useBookStats(bookId: string | undefined, page: number | null) {
  useEffect(() => {
    if (bookId && firstTime(`m365-stat:${bookId}:open`)) send(bookId, { kind: "open" });
  }, [bookId]);

  useEffect(() => {
    if (!bookId || page === null) return;
    const timer = setTimeout(() => {
      if (firstTime(`m365-stat:${bookId}:p${page}`)) send(bookId, { kind: "page", page });
    }, PAGE_DWELL_MS);
    return () => clearTimeout(timer);
  }, [bookId, page]);
}
