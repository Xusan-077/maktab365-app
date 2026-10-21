"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAdminErrorText } from "./useAdminErrorText";

/** So'rov xatosi: bitta gap va "Qayta urinish". */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("admin.common");
  const errorText = useAdminErrorText();
  return (
    <div
      role="alert"
      className="border-danger/40 bg-danger-soft text-danger-soft-foreground flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm"
    >
      <AlertCircle className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{errorText(error)}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}
