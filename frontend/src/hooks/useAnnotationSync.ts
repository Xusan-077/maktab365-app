"use client";

import { useCallback, useEffect, useRef } from "react";
import { getAnnotationQueue, registerFlushScheduler } from "@/lib/books/annotation-sync";
import { toItem } from "@/lib/books/annotations";
import { useBookAnnotationsStore } from "@/stores/book-annotations.store";
import { useAuth } from "./useAuth";

/** Chizish tugagach serverga yuborishdan oldingi kutish (ketma-ket chiziqlar bitta so'rovga tushadi). */
export const ANNOTATION_SAVE_DEBOUNCE_MS = 700;
/** Tarmoq xatosidan keyingi qayta urinish: 2 s dan boshlab, 30 s gacha ikki barobar. */
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

/**
 * Store'dagi o'zgarishlarni (`lastChange`) saqlash navbatiga uzatadi va navbatni yuboradi:
 * debounce, sahifa ochilganda, `online`da, tab yashirilganda / sahifa yopilganda, xatoda backoff bilan.
 * Mehmon uchun hech narsa yuborilmaydi (asboblar ishlatilganda kirish so'raladi).
 */
export function useAnnotationSync() {
  const { sessionUser, signedIn } = useAuth();
  const userId = signedIn ? (sessionUser?.id ?? null) : null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_BASE_MS);
  const retry = useRef<() => void>(() => {});

  const flushNow = useCallback(async () => {
    if (!userId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const result = await getAnnotationQueue(userId).flush();
    if (result === "retry") {
      timer.current = setTimeout(() => retry.current(), retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
    } else {
      retryDelay.current = RETRY_BASE_MS;
    }
  }, [userId]);

  useEffect(() => {
    retry.current = () => void flushNow();
  }, [flushNow]);

  const schedule = useCallback(() => {
    if (!userId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushNow(), ANNOTATION_SAVE_DEBOUNCE_MS);
  }, [userId, flushNow]);

  // Store o'zgarishi → navbat.
  useEffect(() => {
    if (!userId) return;
    let lastSeq = useBookAnnotationsStore.getState().lastChange?.seq ?? 0;
    return useBookAnnotationsStore.subscribe((state) => {
      const change = state.lastChange;
      if (!change || change.seq === lastSeq) return;
      lastSeq = change.seq;
      getAnnotationQueue(userId).enqueue({
        kind: "annotations",
        bookId: change.bookId,
        page: change.page,
        items: change.items.map(toItem),
        at: new Date().toISOString(),
      });
      schedule();
    });
  }, [userId, schedule]);

  useEffect(() => {
    registerFlushScheduler(schedule);
    return () => registerFlushScheduler(null);
  }, [schedule]);

  // Avvalgi sessiyadan qolgan navbat, qayta ulanish, yashirilish.
  useEffect(() => {
    if (!userId) return;
    void flushNow();
    const onOnline = () => void flushNow();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushNow();
    };
    const onPageHide = () => void flushNow();
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
      void flushNow();
    };
  }, [userId, flushNow]);

  return { userId, schedule, flushNow };
}
