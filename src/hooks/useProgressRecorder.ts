import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ProgressEvent } from "@/lib/progress/events";
import { recordForAccount } from "@/lib/progress/record";
import { useGuestStore } from "@/stores/guest.store";
import { useAuth } from "./useAuth";

/**
 * Progress va xatcho'p hodisalarini yozishning yagona yo'li. Mehmon uchun Zustand/localStorage'ga,
 * kirgan foydalanuvchi uchun optimistic keshga va oflayn navbat orqali API'ga yoziladi.
 */
export function useProgressRecorder() {
  const { status, signedIn, sessionUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = sessionUser?.id;
  // Sessiya aniqlanguncha hodisalar kutadi: kirgan foydalanuvchi hodisasi mehmon ma'lumotiga tushmasin.
  const waiting = useRef<ProgressEvent[]>([]);

  const dispatch = useCallback(
    (event: ProgressEvent) => {
      if (signedIn && userId) {
        void recordForAccount(queryClient, userId, event);
        return;
      }
      // Mehmon ma'lumoti o'qilmasdan yozilsa, saqlangan ma'lumot ustidan bo'sh holat yozilib qolardi.
      const { persist } = useGuestStore;
      if (persist.hasHydrated()) useGuestStore.getState().record(event);
      else {
        void Promise.resolve(persist.rehydrate()).then(() =>
          useGuestStore.getState().record(event),
        );
      }
    },
    [signedIn, userId, queryClient],
  );

  useEffect(() => {
    if (status === "loading") return;
    for (const event of waiting.current.splice(0)) dispatch(event);
  }, [status, dispatch]);

  return useCallback(
    (event: ProgressEvent) => {
      if (status === "loading") waiting.current.push(event);
      else dispatch(event);
    },
    [status, dispatch],
  );
}
