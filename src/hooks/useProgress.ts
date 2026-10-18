import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { overlayProgress } from "@/lib/progress/queue";
import { progressFromInput } from "@/lib/progress/reduce";
import { useGuestStore } from "@/stores/guest.store";
import { useSyncStore } from "@/stores/sync.store";
import type { Progress } from "@/types/progress";
import { useAuth } from "./useAuth";

const GUEST_USER_ID = "guest";

export interface ProgressResult {
  data: Progress[] | undefined;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
}

/** Mehmon ma'lumoti localStorage'dan bir marta o'qiladi (SSR bilan mos kelishi uchun qo'lda). */
export function useGuestHydration() {
  useEffect(() => {
    if (!useGuestStore.persist.hasHydrated()) void useGuestStore.persist.rehydrate();
  }, []);
}

/**
 * Progressning yagona o'qish nuqtasi: kirgan foydalanuvchi uchun API (+ hali yuborilmagan
 * yozuvlar), mehmon uchun Zustand/localStorage. Katalog, kitob sahifasi, kabinet shundan o'qiydi.
 */
export function useProgress(): ProgressResult {
  const { status, signedIn } = useAuth();
  const query = useQuery({ ...apiQueries.progress(), enabled: signedIn });
  const pending = useSyncStore((state) => state.pending);
  const guest = useGuestStore((state) => state.progress);
  useGuestHydration();

  return useMemo<ProgressResult>(() => {
    if (status === "loading") {
      return { data: undefined, isPending: true, isError: false, isSuccess: false };
    }
    if (!signedIn) {
      const data = Object.entries(guest).map(([topicId, item]) => ({
        userId: GUEST_USER_ID,
        topicId,
        readStatus: item.readStatus ?? "none",
        exerciseStatus: item.exerciseStatus ?? "none",
        lastBlockId: item.lastBlockId,
        mistakes: item.mistakes,
        solved: item.solved,
        attempts: item.attempts,
        updatedAt: item.updatedAt,
      })) satisfies Progress[];
      return { data, isPending: false, isError: false, isSuccess: true };
    }
    return {
      data:
        query.data &&
        overlayProgress(query.data, pending, (input, existing) =>
          progressFromInput(input, existing, existing?.userId ?? GUEST_USER_ID),
        ),
      isPending: query.isPending,
      isError: query.isError,
      isSuccess: query.isSuccess,
    };
  }, [
    status,
    signedIn,
    guest,
    query.data,
    query.isPending,
    query.isError,
    query.isSuccess,
    pending,
  ]);
}

/** Bitta mavzu progressi (yo'q bo'lsa `data: undefined`). */
export function useTopicProgress(topicId: string) {
  const result = useProgress();
  return useMemo(
    () => ({ ...result, data: result.data?.find((item) => item.topicId === topicId) }),
    [result, topicId],
  );
}
