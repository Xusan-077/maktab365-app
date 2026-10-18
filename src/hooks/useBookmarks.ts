import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useGuestStore } from "@/stores/guest.store";
import { useSyncStore } from "@/stores/sync.store";
import type { Bookmark } from "@/types/progress";
import { useAuth } from "./useAuth";
import { useGuestHydration } from "./useProgress";

const GUEST_USER_ID = "guest";

/**
 * Xatcho'plarning yagona o'qish nuqtasi: kirgan foydalanuvchi uchun API (+ hali yuborilmagan
 * o'zgarishlar), mehmon uchun Zustand/localStorage.
 */
export function useBookmarks() {
  const { status, signedIn } = useAuth();
  const query = useQuery({ ...apiQueries.bookmarks(), enabled: signedIn });
  const pending = useSyncStore((state) => state.pending);
  const guest = useGuestStore((state) => state.bookmarks);
  useGuestHydration();

  return useMemo(() => {
    if (status === "loading") return { data: undefined, isPending: true };
    if (!signedIn) {
      const data: Bookmark[] = guest.map((topicId) => ({
        id: `guest-${topicId}`,
        userId: GUEST_USER_ID,
        topicId,
        createdAt: "",
      }));
      return { data, isPending: false };
    }
    if (!query.data) return { data: undefined, isPending: query.isPending };

    let data = query.data;
    for (const item of pending) {
      if (item.kind !== "bookmark") continue;
      const rest = data.filter((bookmark) => bookmark.topicId !== item.topicId);
      data = item.bookmarked
        ? [
            ...rest,
            {
              id: `pending-${item.topicId}`,
              userId: GUEST_USER_ID,
              topicId: item.topicId,
              createdAt: data.find((b) => b.topicId === item.topicId)?.createdAt ?? "9999",
            },
          ]
        : rest;
    }
    return { data, isPending: false };
  }, [status, signedIn, guest, query.data, query.isPending, pending]);
}

/** Mavzu xatcho'pdami (mehmon va akkaunt uchun bir xil). */
export function useIsBookmarked(topicId: string): boolean {
  const { data } = useBookmarks();
  return Boolean(data?.some((item) => item.topicId === topicId));
}
