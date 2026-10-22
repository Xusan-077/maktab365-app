"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/api/query-keys";
import { setApiSession } from "@/lib/api/session";
import { useToast } from "@/hooks/useToast";
import { clearLegacyStorage } from "@/lib/legacy-storage";
import { mergePdfGuestData } from "@/lib/pdf/guest-merge";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";

const USER_QUERY_KEYS = [
  queryKeys.me(),
  ["pdf-progress"],
  ["pdf-bookmarks"],
  ["pdf-library"],
] as const;

/**
 * Auth.js sessiyasini API klientiga ulaydi va kirgandan keyin mehmonning PDF o'qish pozitsiyasi
 * hamda saqlangan kitoblarini akkauntga qo'shadi. Sessiya `children` renderidan oldin yoziladi,
 * shuning uchun bolalarning birinchi so'rovlari allaqachon to'g'ri akkaunt bilan ketadi.
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
  // idempotent, vaqti yangiroq pozitsiya yutadi). Xatoda ma'lumot saqlanadi va internet qaytganda
  // hamda keyingi kirishda qayta uriniladi; muvaffaqiyatda mehmon store'i tozalanadi.
  useEffect(() => {
    if (!userId) return;
    const merge = () =>
      void mergePdfGuestData({
        api: getPdfBooksApi(),
        load: async () => {
          await usePdfGuestStore.persist.rehydrate();
          const { positions, bookmarks } = usePdfGuestStore.getState();
          return { positions, bookmarks };
        },
        onMerged: () => {
          usePdfGuestStore.getState().clear();
          for (const queryKey of USER_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
          toastRef.current({
            variant: "success",
            title: tRef.current("guestMerged"),
            description: tRef.current("guestMergedHint"),
          });
        },
      });
    merge();
    window.addEventListener("online", merge);
    return () => window.removeEventListener("online", merge);
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
