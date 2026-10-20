import { useCallback } from "react";
import { useTranslations } from "next-intl";

/** Validatsiya kaliti yoki backend kodi → `authForm.errors.*` matni (noma'lum kod — umumiy xabar). */
export function useAuthErrorText() {
  const t = useTranslations("authForm.errors");
  return useCallback(
    (code?: string) => {
      if (!code) return undefined;
      return t.has(code) ? t(code as "unknown") : t("unknown");
    },
    [t],
  );
}
