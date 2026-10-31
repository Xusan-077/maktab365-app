import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { broadcastSessionEvent } from "@/lib/auth/session-sync";
import { dashboardPath, ROUTES, safeCallbackPath } from "@/lib/utils/routes";

/**
 * Kirish/ro'yxatdan o'tishdan keyingi sahifa: onboarding tugamagan → `/onboarding`,
 * aks holda `callbackUrl` (shu saytniki bo'lsa) yoki rolga mos panel.
 */
export function useCompleteSignIn() {
  const router = useRouter();
  const locale = useLocale();

  return useCallback(
    async (callbackUrl?: string | null) => {
      const user = (await getSession())?.user;
      broadcastSessionEvent("signed-in");
      const callback = safeCallbackPath(callbackUrl);
      const target =
        user?.staff === "admin"
          ? // Admin faqat admin panelda: boshqa `callbackUrl` e'tiborsiz (proxy baribir qaytaradi).
            callback?.startsWith(`/${locale}${ROUTES.admin}`)
            ? callback
            : `/${locale}${ROUTES.admin}`
          : user?.onboarded === false
            ? `/${locale}${ROUTES.onboarding}`
            : (callback ?? `/${locale}${dashboardPath(user?.role ?? "student")}`);
      router.replace(target);
      router.refresh();
    },
    [router, locale],
  );
}
