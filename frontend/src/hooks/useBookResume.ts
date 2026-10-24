"use client";

import { readFraction } from "@/components/pdf/PdfBookCard";
import { isBookRead, usePdfProgressMap } from "./usePdfProgressMap";

/**
 * Bitta kitob bo'yicha o'qish holati (kirgan: server, mehmon: brauzer — `usePdfProgressMap`):
 * ulush/foiz, o'qilganmi va "N-betdan davom ettirish" uchun bet (1-betda yoki o'qib bo'lingan
 * kitobda — `undefined`, ya'ni oddiy "Onlayn o'qish").
 */
export function useBookResume(bookId: string, pageCount: number) {
  const entry = usePdfProgressMap()[bookId];
  const read = isBookRead(entry, pageCount);
  const fraction = readFraction(entry?.page, pageCount, read);
  return {
    entry,
    read,
    fraction,
    percent: Math.round(fraction * 100),
    resumePage: entry && entry.page > 1 && !read ? entry.page : undefined,
  };
}
