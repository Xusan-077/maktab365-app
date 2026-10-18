"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { getApi } from "@/lib/api";
import { apiQueries } from "@/lib/api/queries";
import { queryKeys } from "@/lib/api/query-keys";
import { setApiSession } from "@/lib/api/session";
import { RoleCookieSync } from "./RoleCookieSync";
import { useToast } from "@/hooks/useToast";
import { getSyncQueue, stopSync } from "@/lib/progress/engine";
import { collectGuestData, hasGuestData, mergeGuestData } from "@/lib/merge-guest-data";
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
  const mergedFor = useRef<string | null>(null);

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

  useEffect(() => {
    if (!userId || mergedFor.current === userId) return;
    mergedFor.current = userId;
    let active = true;
    (async () => {
      await Promise.all([useGuestStore.persist.rehydrate(), useReadingStore.persist.rehydrate()]);
      if (!active) return;
      const { progress, bookmarks } = useGuestStore.getState();
      const guest = collectGuestData({ progress, bookmarks }, useReadingStore.getState().positions);
      if (!hasGuestData(guest)) return;
      const result = await mergeGuestData(getApi(), guest);
      if (result.failed.length === 0) useGuestStore.getState().clear();
      for (const queryKey of USER_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
      toast({
        variant: "success",
        title: t("guestMerged"),
        description: t("guestMergedHint"),
      });
    })().catch(() => {
      // Qo'shish muvaffaqiyatsiz bo'lsa mehmon ma'lumoti saqlanib qoladi; keyingi kirishda qayta uriniladi.
      mergedFor.current = null;
    });
    return () => {
      active = false;
    };
  }, [userId, queryClient, toast, t]);

  return children;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthBridge>
        <RoleCookieSync />
        {children}
      </AuthBridge>
    </SessionProvider>
  );
}
