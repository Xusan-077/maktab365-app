"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";

/** `{ [pdfBookId]: oxirgi sahifa }` — katalogdagi "davom etish" belgisi uchun. */
export function usePdfProgressMap(): Record<string, number> {
  const { signedIn } = useAuth();
  const guest = usePdfGuestStore((state) => state.positions);
  const account = useQuery({ ...pdfQueries.allProgress(), enabled: signedIn });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const map: Record<string, number> = {};
  for (const [id, position] of Object.entries(guest)) map[id] = position.page;
  for (const row of account.data ?? []) map[row.pdf_book_id] = row.last_page;
  return map;
}
