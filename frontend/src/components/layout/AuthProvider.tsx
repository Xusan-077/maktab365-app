"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { getApi } from "@/lib/api";
import { apiQueries } from "@/lib/api/queries";
import { queryKeys } from "@/lib/api/query-keys";
import { setApiSession } from "@/lib/api/session";
import { useToast } from "@/hooks/useToast";
import { getSyncQueue, refreshAccountData, stopSync } from "@/lib/progress/engine";
import { GuestMerger } from "@/lib/progress/guest-merge";
import { collectGuestData } from "@/lib/merge-guest-data";
import { useGuestStore } from "@/stores/guest.store";
import { useReadingStore } from "@/stores/reading.store";

const USER_QUERY_KEYS = [
  queryKeys.me(),
  queryKeys.bookmarks(),
  queryKeys.bookBookmarks(),
  queryKeys.goals(),
  ["progress"],
] as const;

/**
 * Auth.js sessiyasini API klientiga ulaydi va kirgandan keyin mehmon ma'lumotini akkauntga qo'shadi.
 * Sessiya `children` renderidan oldin yoziladi, shuning uchun bolalarning birinchi so'rovlari
 * allaqachon to'g'ri akkaunt bilan ketadi.
 */
function AuthBridge({ children }: { children: ReactNode }) {
  const { data, status } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("auth");
  const userId = data?.user?.id ?? null;
  const userName = data?.user?.name ?? "";

  // Idempotent modul o'zgaruvchisi; render paytida yozish bolalardan oldin ishlashi uchun kerak.
  setApiSession(userId ? { id: userId, name: userName } : null);

  const knownUserId = useRef<string | null | undefined>(undefined);
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  useEffect(() => {
    toastRef.current = toast;
    tRef.current = t;
  });

  useEffect(() => {
    void useGuestStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    const previous = knownUserId.current;
    knownUserId.current = userId;
    if (previous !== undefined && previous !== userId) {
      for (const queryKey of USER_QUERY_KEYS) void queryClient.resetQueries({ queryKey });
    }
  }, [status, userId, queryClient]);

  // Akkaunt yozuvlari navbati: kirganda progress oldindan yuklanadi, saqlanib qolgan (oflayn)
  // yozuvlar yuboriladi, internet qaytganda qayta uriniladi.
  useEffect(() => {
    if (!userId) {
      stopSync();
      return;
    }
    const queue = getSyncQueue(userId, queryClient);
    void queryClient.prefetchQuery(apiQueries.progress());
    void queue.flush();
    const onOnline = () => void queue.flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      stopSync();
    };
  }, [userId, queryClient]);

  // Birinchi kirishdan keyin mehmon ma'lumoti akkauntga qo'shiladi (server idempotent). Xatoda
  // ma'lumot saqlanadi va eksponensial kechikish bilan, internet qaytganda hamda keyingi kirishda
  // qayta uriniladi; muvaffaqiyatda mehmon store'i tozalanadi.
  useEffect(() => {
    if (!userId) return;
    const merger = new GuestMerger({
      api: getApi(),
      load: async () => {
        await Promise.all([useGuestStore.persist.rehydrate(), useReadingStore.persist.rehydrate()]);
        const { progress, bookmarks } = useGuestStore.getState();
        return collectGuestData({ progress, bookmarks }, useReadingStore.getState().positions);
      },
      onMerged: (result) => {
        useGuestStore.getState().clear();
        refreshAccountData(queryClient);
        for (const queryKey of USER_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
        // Faqat haqiqatan nimadir qo'shilganda xabar beramiz (reading pozitsiyalari har kirishda yig'iladi).
        if (result.progress + result.bookmarks > 0) {
          toastRef.current({
            variant: "success",
            title: tRef.current("guestMerged"),
            description: tRef.current("guestMergedHint"),
          });
        }
      },
    });
    void merger.start();
    const onOnline = () => merger.retryNow();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      merger.dispose();
    };
  }, [userId, queryClient]);

  return children;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthBridge>{children}</AuthBridge>
    </SessionProvider>
  );
}
