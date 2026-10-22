"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { mergeReadStatus, type ReadStatus } from "@/lib/pdf/progress";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";

export interface PdfProgressEntry {
  /** Oxirgi sahifa. */
  page: number;
  /** Kirgan foydalanuvchida server holati; mehmonda kitob uzunligi bilan `isBookRead` hisoblaydi. */
  status: ReadStatus | null;
}

/** `{ [pdfBookId]: oxirgi sahifa va holat }` — katalogdagi "davom etish" va "o'qilgan" belgilari uchun. */
export function usePdfProgressMap(): Record<string, PdfProgressEntry> {
  const { signedIn } = useAuth();
  const guest = usePdfGuestStore((state) => state.positions);
  const account = useQuery({ ...pdfQueries.allProgress(), enabled: signedIn });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const map: Record<string, PdfProgressEntry> = {};
  for (const [id, position] of Object.entries(guest))
    map[id] = { page: position.page, status: null };
  for (const row of account.data ?? []) {
    map[row.pdf_book_id] = { page: row.last_page, status: row.read_status };
  }
  return map;
}

/** Kitob o'qilganmi: server holati yoki (mehmon) oxirgi betga yetilgani. */
export function isBookRead(entry: PdfProgressEntry | undefined, pageCount: number): boolean {
  return entry !== undefined && mergeReadStatus(entry.status, entry.page, pageCount) === "read";
}
