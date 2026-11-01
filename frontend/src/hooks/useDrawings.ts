"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAnnotationQueue } from "@/lib/books/annotation-sync";
import { groupByPage, parseAnnotations, toItem } from "@/lib/books/annotations";
import { GuestDrawings, mergeGuestItems } from "@/lib/books/guest-drawings";
import { bookQueries } from "@/lib/books/queries";
import { useBookAnnotationsStore } from "@/stores/book-annotations.store";
import { useAnnotationSync } from "./useAnnotationSync";
import { useAuth } from "./useAuth";

type ServerRow = { id: string; type: string; data: unknown };

/** Joriy bet va qo'shnilari (±1): varaqlashda chizma "yuklanmoqda" bo'lib turmasin. */
export const DRAWING_WINDOW = 1;

export function drawingWindow(page: number, total: number): number[] {
  const pages: number[] = [];
  for (let n = page - DRAWING_WINDOW; n <= page + DRAWING_WINDOW; n += 1) {
    if (n >= 1 && n <= total) pages.push(n);
  }
  return pages;
}

/**
 * O'qish oynasidagi chizmalar (darslik ham, Kutubxona kitobi ham — backend `/me/books/<id>/…`):
 *
 * - **Kirgan foydalanuvchi:** joriy ±1 bet serverdan yuklanadi; navbatdagi (hali yuborilmagan,
 *   IndexedDB'dagi) holat server nusxasidan ustun. O'zgarish 2 s debounce bilan faqat o'sha bet
 *   uchun yuboriladi (`useAnnotationSync`); internet yo'q bo'lsa navbatda qoladi.
 * - **Mehmon:** chizmalar faqat shu qurilmada (`GuestDrawings`, IndexedDB). Kirgandan keyin ochilgan
 *   betlardagi mehmon chizmalari akkauntga qo'shiladi va qurilmadan o'chiriladi.
 */
export function useDrawings(bookId: string, page: number | null, total: number) {
  const { sessionUser, signedIn, status } = useAuth();
  const userId = signedIn ? (sessionUser?.id ?? null) : null;
  const owner = status === "loading" ? null : (userId ?? "guest");
  const guest = useMemo(() => new GuestDrawings(bookId), [bookId]);
  const attach = useBookAnnotationsStore((state) => state.attach);
  const hydrate = useBookAnnotationsStore((state) => state.hydrate);
  const sync = useAnnotationSync();
  /** Mehmon chizmalari qurilmadan o'qilgan kitob (o'qilmaguncha chizish yopiq — ustidan yozilmasin). */
  const [guestLoaded, setGuestLoaded] = useState<string | null>(null);

  // Kitob yoki egasi (mehmon → akkaunt) almashsa — betlar va tarix qaytadan yuklanadi.
  useEffect(() => {
    if (owner) attach(bookId, owner);
  }, [attach, bookId, owner]);

  const pages = useMemo(
    () => (page === null || total === 0 ? [] : drawingWindow(page, total)),
    [page, total],
  );
  const query = useQuery({
    ...bookQueries.annotations(bookId, pages),
    enabled: Boolean(userId) && pages.length > 0,
  });
  const loadedHere = useBookAnnotationsStore((state) =>
    page === null ? false : state.owner === owner && Boolean(state.pages[page]),
  );

  // Kirgan: server + navbat (+ qurilmada qolgan mehmon chizmalari bir marta qo'shiladi).
  useEffect(() => {
    if (!query.data || !userId) return;
    let cancelled = false;
    const queue = getAnnotationQueue(userId);
    void Promise.all([queue.ready, guest.load()]).then(([, guestPages]) => {
      if (cancelled || useBookAnnotationsStore.getState().owner !== userId) return;
      const grouped = groupByPage(query.data);
      const moved: number[] = [];
      for (const number of pages) {
        const queued = queue.find("annotations", bookId, number);
        const account: readonly ServerRow[] = queued ? queued.items : (grouped.get(number) ?? []);
        const fromGuest: readonly ServerRow[] = guestPages[number] ?? [];
        if (fromGuest.length > 0) {
          const merged = parseAnnotations(mergeGuestItems(account, fromGuest));
          hydrate(number, parseAnnotations(account));
          // Tarixga qadam + serverga yuborish (navbat orqali).
          useBookAnnotationsStore.getState().commit(number, merged);
          moved.push(number);
        } else {
          hydrate(number, parseAnnotations(account));
        }
      }
      if (moved.length > 0) void guest.removePages(moved);
    });
    return () => {
      cancelled = true;
    };
  }, [query.data, userId, bookId, pages, guest, hydrate]);

  // Mehmon: qurilmadagi chizmalar bir marta o'qiladi, keyin har o'zgarish darhol yoziladi.
  useEffect(() => {
    if (owner !== "guest") return;
    let cancelled = false;
    void guest.load().then((stored) => {
      if (cancelled || useBookAnnotationsStore.getState().owner !== "guest") return;
      for (const [number, items] of Object.entries(stored)) {
        hydrate(Number(number), parseAnnotations(items));
      }
      setGuestLoaded(bookId);
    });
    let lastSeq = useBookAnnotationsStore.getState().lastChange?.seq ?? 0;
    const unsubscribe = useBookAnnotationsStore.subscribe((state) => {
      const change = state.lastChange;
      if (!change || change.seq === lastSeq || state.owner !== "guest") return;
      lastSeq = change.seq;
      void guest.savePage(change.page, change.items.map(toItem)).catch(() => undefined);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [owner, guest, hydrate, bookId]);

  return {
    signedIn: Boolean(userId),
    /** Joriy betning chizmalari tayyor. */
    ready: owner === "guest" ? guestLoaded === bookId : loadedHere,
    error: Boolean(userId) && query.isError,
    retry: () => void query.refetch(),
    /** «Qayta urinish»: navbatni darhol yuborish. */
    flushNow: sync.flushNow,
  };
}
