"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";

export interface BookPosition {
  /** Holat aniq bo'lguncha `false` (serverda va birinchi renderda ham) — UI skelet ko'rsatadi. */
  ready: boolean;
  /** Oxirgi o'qilgan bet; o'qilmagan — `null`. */
  page: number | null;
  /** Oxirgi yozuv vaqti (ISO). */
  updatedAt: string | null;
}

const subscribeHydration = (onChange: () => void) =>
  usePdfGuestStore.persist.onFinishHydration(onChange);
const guestHydrated = () => usePdfGuestStore.persist.hasHydrated();

/**
 * Bitta kitobdagi oxirgi o'qilgan bet: kirgan foydalanuvchida backend (`allProgress`), backend
 * yozuvi bo'lmasa yoki xato bo'lsa — mehmon (Zustand persist). `ready` — sessiya va manba
 * yuklangach; shu paytgacha foydalanuvchiga xos qismlar ko'rsatilmaydi (hydration mos keladi).
 */
export function useBookPosition(bookId: string): BookPosition {
  const { status, signedIn } = useAuth();
  const guest = usePdfGuestStore((state) => state.positions[bookId]);
  const hydrated = useSyncExternalStore(subscribeHydration, guestHydrated, () => false);
  const account = useQuery({ ...pdfQueries.allProgress(), enabled: signedIn });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const row = account.data?.find((item) => item.pdf_book_id === bookId);
  const ready = hydrated && status !== "loading" && (!signedIn || !account.isPending);
  if (!ready) return { ready, page: null, updatedAt: null };
  if (row) return { ready, page: row.last_page, updatedAt: row.updated_at };
  return { ready, page: guest?.page ?? null, updatedAt: guest?.updatedAt ?? null };
}
