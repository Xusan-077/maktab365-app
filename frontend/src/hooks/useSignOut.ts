import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useLocale } from "next-intl";
import { setApiSession } from "@/lib/api/session";
import { broadcastSessionEvent } from "@/lib/auth/session-sync";

/**
 * Yagona chiqish yo'li: cookie (Auth.js `signOut`, backend refresh bekor qilinadi), TanStack Query
 * keshi va API sessiyasi tozalanadi, boshqa tablarga xabar beriladi. Hamma "Chiqish" tugmalari shuni ishlatadi.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const locale = useLocale();

  return useCallback(async () => {
    broadcastSessionEvent("signed-out");
    setApiSession(null);
    queryClient.clear();
    await signOut({ redirectTo: `/${locale}` });
  }, [queryClient, locale]);
}
