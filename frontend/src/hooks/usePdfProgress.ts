"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/lib/api/retry";
import { mergePdfPosition, resumePage, type PdfPosition } from "@/lib/pdf/progress";
import type { PdfProgress } from "@/lib/pdf-books/api";
import { invalidateReadingData } from "@/lib/pdf-books/cache";
import { pdfKeys, pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";
import { useWriteQueue } from "./useWriteQueue";

/** Akkaunt yozuvi serverga shuncha kechikish bilan yuboriladi (sahifa varaqlashda har bosishda emas). */
const SAVE_DEBOUNCE_MS = 700;

const subscribeHydration = (callback: () => void) =>
  usePdfGuestStore.persist.onFinishHydration(callback);
const isHydrated = () => usePdfGuestStore.persist.hasHydrated();

/**
 * PDF darslikda oxirgi ochilgan sahifa. Kirgan foydalanuvchi uchun backend'da (idempotent PUT),
 * mehmon uchun brauzerda (`pdf-guest.store`); kirishda mavjud guest merge birlashtiradi.
 *
 * Yozuv avval keshda ko'rinadi (optimistic), so'ng yozuvlar navbati orqali yuboriladi: internet
 * yo'q/sekin bo'lsa navbatda qoladi va qayta uriniladi; doimiy rad etilsa kesh qaytariladi.
 * Server xatosi o'qishni to'xtatmaydi: pozitsiya so'rovi 4xx'da qayta urinmaydi, sahifa 1-betdan.
 *
 * `track: false` (admin oldindan ko'rishi): hech narsa so'ralmaydi, yozilmaydi va yuborilmaydi.
 */
export function usePdfProgress(
  bookId: string,
  pageCount: number,
  { track = true }: { track?: boolean } = {},
) {
  const { status, signedIn } = useAuth();
  const queue = useWriteQueue();
  const queryClient = useQueryClient();
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, () => false);
  const guest = usePdfGuestStore((state) => state.positions[bookId]);
  const account = useQuery({
    ...pdfQueries.progress(bookId),
    enabled: signedIn && track,
    retry: retryUnlessClientError,
  });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const save = useMutation({
    // Offline'da ham ishlaydi: yozuv `WriteQueue` ga tushadi (standart 'online' rejimida mutatsiya kutib qolardi).
    networkMode: "always",
    mutationFn: async ({ page, at }: { page: number; at: string }) => {
      if (!queue) throw new Error("not signed in");
      return queue.run({ kind: "progress", bookId, page, at });
    },
    onMutate: ({ page, at }) => {
      const previous = queryClient.getQueryData<PdfProgress | null>(pdfKeys.progress(bookId));
      const finished = pageCount >= 1 && page >= pageCount;
      queryClient.setQueryData<PdfProgress>(pdfKeys.progress(bookId), {
        pdf_book_id: bookId,
        last_page: page,
        read_status: finished ? "read" : (previous?.read_status ?? "in_progress"),
        updated_at: at,
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      // Server doimiy rad etdi (masalan kitob yashirildi): ko'rsatilgan sahifa qaytariladi.
      queryClient.setQueryData(pdfKeys.progress(bookId), context?.previous ?? null);
    },
    onSuccess: (outcome) => {
      if (outcome === "sent") void invalidateReadingData(queryClient);
    },
  });

  // Kitob ochilishi serverga bildiriladi (idempotent): sahifa o'zgarmasa ham "oxirgi ochilganlar"da chiqadi.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!track || !queue || opened.current === bookId) return;
    opened.current = bookId;
    queue.run({ kind: "event", bookId, event: "book_opened" }).then(
      (outcome) => {
        if (outcome === "sent") void invalidateReadingData(queryClient);
      },
      () => undefined,
    );
  }, [track, queue, bookId, queryClient]);

  const accountPosition: PdfPosition | null = account.data
    ? { page: account.data.last_page, updatedAt: account.data.updated_at }
    : null;
  const position = track ? mergePdfPosition(accountPosition, guest) : null;
  const ready = !track || (status !== "loading" && hydrated && (!signedIn || !account.isPending));

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
      if (!track) return;
      if (!signedIn) {
        usePdfGuestStore.getState().record(bookId, page);
        return;
      }
      pending.current = page;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [track, signedIn, bookId, flush],
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
