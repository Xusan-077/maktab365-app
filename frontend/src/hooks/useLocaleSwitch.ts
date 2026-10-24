"use client";

import { useTransition } from "react";
import { isLocale, LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

/** Tilni almashtiradi: tanlov cookie'da saqlanadi (keyingi tashrifda `/` shu tilga yo'naltiradi). */
export function useLocaleSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (!isLocale(next)) return;
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => {
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  return { switchTo, pending };
}
