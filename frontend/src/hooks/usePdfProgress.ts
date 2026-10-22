"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mergePdfPosition, resumePage, type PdfPosition } from "@/lib/pdf/progress";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { pdfKeys, pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";

/** Akkaunt yozuvi serverga shuncha kechikish bilan yuboriladi (sahifa varaqlashda har bosishda emas). */
const SAVE_DEBOUNCE_MS = 700;

const subscribeHydration = (callback: () => void) =>
  usePdfGuestStore.persist.onFinishHydration(callback);
const isHydrated = () => usePdfGuestStore.persist.hasHydrated();

/**
 * PDF darslikda oxirgi ochilgan sahifa. Kirgan foydalanuvchi uchun backend'da (idempotent PUT),
 * mehmon uchun brauzerda (`pdf-guest.store`); kirishda mavjud guest merge birlashtiradi.
 */
export function usePdfProgress(bookId: string, pageCount: number) {
  const { status, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, () => false);
  const guest = usePdfGuestStore((state) => state.positions[bookId]);
  const account = useQuery({ ...pdfQueries.progress(bookId), enabled: signedIn });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const save = useMutation({
    mutationFn: ({ page, at }: { page: number; at: string }) =>
      getPdfBooksApi().saveProgress(bookId, page, at),
    retry: 3,
    onSuccess: (saved) => {
      queryClient.setQueryData(pdfKeys.progress(bookId), saved);
      void queryClient.invalidateQueries({ queryKey: pdfKeys.allProgress() });
    },
  });

  const accountPosition: PdfPosition | null = account.data
    ? { page: account.data.last_page, updatedAt: account.data.updated_at }
    : null;
  const position = mergePdfPosition(accountPosition, guest);
  const ready = status !== "loading" && hydrated && (!signedIn || !account.isPending);

  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { mutate } = save;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const page = pending.current;
    if (page === null) return;
    pending.current = null;
    mutate({ page, at: new Date().toISOString() });
  }, [mutate]);

  /** Joriy sahifani eslab qoladi. */
  const record = useCallback(
    (page: number) => {
      if (!signedIn) {
        usePdfGuestStore.getState().record(bookId, page);
        return;
      }
      pending.current = page;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [signedIn, bookId, flush],
  );

  // Sahifadan chiqishda yoki yopishda kutayotgan yozuv yuboriladi.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return {
    ready,
    /** Saqlangan pozitsiya (bo'lmasa `null`). */
    position,
    /** Ochilganda boshlanadigan sahifa. */
    resume: resumePage(position, pageCount),
    record,
  };
}
