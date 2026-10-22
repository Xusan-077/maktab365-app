"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bookmarkOverridesKey,
  clearBookmarkOverride,
  getBookmarkOverrides,
  invalidateReadingData,
  setBookmarkOverride,
  type BookmarkOverrides,
} from "@/lib/pdf-books/cache";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";
import { useAuth } from "./useAuth";
import { useWriteQueue } from "./useWriteQueue";

/**
 * Saqlangan PDF darsliklar. Kirgan foydalanuvchi uchun backend'da (idempotent PUT/DELETE), mehmon
 * uchun brauzerda (`pdf-guest.store`); kirishda mavjud guest merge birlashtiradi.
 *
 * Kirganda tugma darhol o'zgaradi (optimistic): doimiy rad etilsa (4xx) o'zgarish qaytariladi,
 * tarmoq yo'q/sekin bo'lsa yozuv navbatga tushadi va qayta uriniladi (`lib/offline/write-queue`).
 */
export function usePdfBookmarks() {
  const { signedIn } = useAuth();
  const queue = useWriteQueue();
  const queryClient = useQueryClient();
  const guest = usePdfGuestStore((state) => state.bookmarks);
  const account = useQuery({ ...pdfQueries.bookmarks(), enabled: signedIn });
  const { data: overrides = {} } = useQuery<BookmarkOverrides>({
    queryKey: bookmarkOverridesKey(),
    queryFn: () => getBookmarkOverrides(queryClient),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: false,
    initialData: () => getBookmarkOverrides(queryClient),
  });

  useEffect(() => {
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  const save = useMutation({
    // Offline'da ham ishlaydi: yozuv `WriteQueue` ga tushadi (standart 'online' rejimida mutatsiya kutib qolardi).
    networkMode: "always",
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (!queue) throw new Error("not signed in");
      return queue.run({ kind: "bookmark", bookId: id, saved });
    },
    onMutate: async ({ id, saved }) => {
      const previous = getBookmarkOverrides(queryClient);
      const had = id in previous;
      setBookmarkOverride(queryClient, id, saved);
      return { had, before: previous[id] };
    },
    onError: (_error, { id }, context) => {
      // Server doimiy rad etdi: optimistic o'zgarish qaytariladi.
      if (context?.had && context.before !== undefined) {
        setBookmarkOverride(queryClient, id, context.before);
      } else {
        clearBookmarkOverride(queryClient, id);
      }
    },
    onSuccess: async (outcome, { id, saved }) => {
      // `queued` — o'zgarish ko'rinishda qoladi; navbat yuborgach (AuthProvider) tozalanadi.
      if (outcome !== "sent") return;
      await invalidateReadingData(queryClient);
      // Orada yangi bosish bo'lgan bo'lsa (boshqa qiymat), uning qatlamiga tegmaymiz.
      if (getBookmarkOverrides(queryClient)[id] === saved) clearBookmarkOverride(queryClient, id);
    },
  });
  const { mutate } = save;

  const accountRows = account.data;
  const savedIds = useMemo(() => {
    if (!signedIn) return guest;
    const serverIds = (accountRows ?? []).map((row) => row.book.id);
    const added = Object.entries(overrides)
      .filter(([id, saved]) => saved && !serverIds.includes(id))
      .map(([id]) => id);
    return [...serverIds.filter((id) => overrides[id] !== false), ...added];
  }, [signedIn, guest, accountRows, overrides]);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const setSaved = useCallback(
    (id: string, saved: boolean) => {
      if (signedIn) mutate({ id, saved });
      else usePdfGuestStore.getState().setBookmark(id, saved);
    },
    [signedIn, mutate],
  );

  return {
    /** Akkaunt ro'yxati hali yuklanmagan bo'lsa `false`: tugma holati noaniq. */
    ready: !signedIn || !account.isPending,
    isSaved,
    setSaved,
    /** Navbatda yuborilmagan o'zgarishlar bor (offline). */
    queued: signedIn && Object.keys(overrides).length > 0,
    error: save.error,
  };
}
