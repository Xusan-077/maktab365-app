"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { fieldErrorCode, gradeConflicts, knownErrorCode } from "@/lib/admin/errors";

/** Backend xatosi → admin matni: avval barqaror `code`, bo'lmasa umumiy xabar. */
export function useAdminErrorText() {
  const t = useTranslations("admin.errors");
  return useCallback(
    (error: unknown): string => {
      const conflicts = gradeConflicts(error);
      if (conflicts.length > 0) {
        return conflicts.map((c) => t("gradeHasBooks", c)).join(" ");
      }
      const code = knownErrorCode(error);
      return code ? t(`codes.${code}`) : t("generic");
    },
    [t],
  );
}

/** Maydon xatosi (`details[field][0]` kodi) matni; kod noma'lum bo'lsa umumiy "noto'g'ri qiymat". */
export function useAdminFieldErrorText() {
  const t = useTranslations("admin.errors");
  return useCallback(
    (error: unknown, field: string): string | undefined => {
      const code = fieldErrorCode(error, field);
      if (!code) return undefined;
      return t.has(`fields.${code}`) ? t(`fields.${code}`) : t("fields.invalid");
    },
    [t],
  );
}
