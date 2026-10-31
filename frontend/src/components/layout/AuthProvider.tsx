"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/api/query-keys";
import { setApiSession } from "@/lib/api/session";
import { useToast } from "@/hooks/useToast";
import { onSessionEvent } from "@/lib/auth/session-sync";
import { PROTECTED_ROUTES, ROUTES } from "@/lib/utils/routes";
import { clearLegacyStorage } from "@/lib/legacy-storage";
import { getWriteQueue, onWriteSent } from "@/lib/offline/pdf-write-queue";
import { mergePdfGuestData, mergeRetryDelay } from "@/lib/pdf/guest-merge";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import {
  clearBookmarkOverride,
  getBookmarkOverrides,
  invalidateReadingData,
} from "@/lib/pdf-books/cache";
import { usePdfAnnotationsGuestStore } from "@/stores/pdf-annotations-guest.store";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";

const USER_QUERY_KEYS = [
  queryKeys.me(),
  ["pdf-progress"],
  ["pdf-bookmarks"],
  ["pdf-bookmarks-pending"],
  ["pdf-annotations"],
  ["pdf-library"],
  ["pdf-dashboard"],
  ["pdf-results"],
  ["pdf-goals"],
] as const;

/** Yozuvlar navbatida qolgan amallar shuncha oraliqda qayta yuboriladi (internet bor, server sekin bo'lsa). */
export const QUEUE_RETRY_MS = 30_000;

/**
 * Auth.js sessiyasini API klientiga ulaydi va kirgandan keyin mehmonning PDF o'qish pozitsiyasi
 * hamda saqlangan kitoblarini akkauntga qo'shadi. Sessiya `children` renderidan oldin yoziladi,
 * shuning uchun bolalarning birinchi so'rovlari allaqachon to'g'ri akkaunt bilan ketadi.
 */
function AuthBridge({ children }: { children: ReactNode }) {
  const { data, status, update } = useSession();
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

  // Boshqa tabda chiqilsa: shu tabdagi shaxsiy ma'lumot keshi tozalanadi va himoyalangan/kirish
  // sahifasidan bosh sahifaga o'tiladi; kirilsa — sessiya qayta o'qiladi (kirish sahifasi panelga o'tadi).
  useEffect(
    () =>
      onSessionEvent((message) => {
        const path = window.location.pathname.replace(/^\/[^/]+(?=\/)/, "") || "/";
        const isUnder = (route: string) => path === route || path.startsWith(`${route}/`);
        if (message === "signed-out") {
          setApiSession(null);
          queryClient.clear();
          if ([...PROTECTED_ROUTES, ROUTES.onboarding].some(isUnder)) {
            // Qattiq o'tish ataylab: eski sessiya holati xotirada qolmasin.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = `/${window.location.pathname.split("/")[1]}`;
            return;
          }
        } else if (isUnder(ROUTES.login) || isUnder(ROUTES.register) || isUnder(ROUTES.otp)) {
          window.location.reload();
          return;
        }
        void update();
      }),
    [queryClient, update],
  );

  useEffect(() => {
    clearLegacyStorage();
    void usePdfGuestStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    const previous = knownUserId.current;
    knownUserId.current = userId;
    if (previous !== undefined && previous !== userId) {
      for (const queryKey of USER_QUERY_KEYS) void queryClient.resetQueries({ queryKey });
    }
  }, [status, userId, queryClient]);

  // Birinchi kirishdan keyin mehmon ma'lumoti akkauntga qo'shiladi (`merge-guest-data/`; server
  // idempotent, vaqti yangiroq pozitsiya yutadi). Xatoda ma'lumot saqlanadi va internet qaytganda,
  // kutish oralig'i oshib boruvchi taymerda hamda keyingi kirishda qayta uriniladi; muvaffaqiyatda
  // mehmon store'i tozalanadi.
  useEffect(() => {
    if (!userId) return;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const merge = async () => {
      clearTimeout(timer);
      const outcome = await mergePdfGuestData({
        api: getPdfBooksApi(),
        load: async () => {
          await usePdfGuestStore.persist.rehydrate();
          await usePdfAnnotationsGuestStore.persist.rehydrate();
          const { positions, bookmarks } = usePdfGuestStore.getState();
          const annotations = usePdfAnnotationsGuestStore.getState().items;
          return { positions, bookmarks, annotations };
        },
        onMerged: () => {
          usePdfGuestStore.getState().clear();
          usePdfAnnotationsGuestStore.getState().clear();
          for (const queryKey of USER_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
          toastRef.current({
            variant: "success",
            title: tRef.current("guestMerged"),
            description: tRef.current("guestMergedHint"),
          });
        },
      });
      if (stopped) return;
      if (outcome === "failed") {
        failures += 1;
        timer = setTimeout(() => void merge(), mergeRetryDelay(failures));
      } else {
        failures = 0;
      }
    };
    const onOnline = () => void merge();
    void merge();
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [userId, queryClient]);

  // Offline/sekin internetda navbatga tushgan yozuvlar (sahifa, xatcho'p, hodisa) qayta yuboriladi:
  // kirganda, internet qaytganda, sahifa yana ko'ringanda va navbat bo'sh bo'lmaguncha taymerda.
  useEffect(() => {
    if (!userId) return;
    const queue = getWriteQueue(userId);
    const flush = () => {
      if (queue.size > 0) void queue.flush();
    };
    const stopListening = onWriteSent((op) => {
      void invalidateReadingData(queryClient).then(() => {
        if (op.kind === "bookmark" && getBookmarkOverrides(queryClient)[op.bookId] === op.saved) {
          clearBookmarkOverride(queryClient, op.bookId);
        }
      });
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") flush();
    };
    flush();
    const interval = setInterval(flush, QUEUE_RETRY_MS);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopListening();
      clearInterval(interval);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
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
