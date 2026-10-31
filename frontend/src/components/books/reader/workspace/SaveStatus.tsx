"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deriveSaveState, useAnnotationSyncStore } from "@/stores/annotation-sync.store";
import { cn } from "@/lib/utils/cn";

export interface SaveStatusProps {
  /** Qayta urinish: navbatni darhol yuboradi. */
  onRetry: () => void;
  className?: string;
}

/** Saqlash holati: «Saqlanmoqda…» / «Saqlandi» / «Saqlanmadi, qayta urinish». Ekran o'qigichga `status` sifatida. */
export function SaveStatus({ onRetry, className }: SaveStatusProps) {
  const t = useTranslations("books.workspace.save");
  const queue = useAnnotationSyncStore((state) => state.queue);
  const savedAt = useAnnotationSyncStore((state) => state.savedAt);
  const state = deriveSaveState(queue, savedAt);

  if (state === "idle") return <span className={className} role="status" />;

  if (state === "error" || state === "rejected") {
    return (
      <span role="status" className={cn("flex items-center gap-1.5 text-xs", className)}>
        <AlertTriangle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
        <span className="text-red-700 dark:text-red-300">
          {state === "rejected" && queue.code === "page_too_large" ? t("tooLarge") : t("failed")}
        </span>
        {state === "error" && (
          <button
            type="button"
            onClick={onRetry}
            className="text-bk-accent focus-visible:outline-bk-accent min-h-6 rounded px-1 font-medium underline underline-offset-2"
          >
            {t("retry")}
          </button>
        )}
      </span>
    );
  }

  return (
    <span
      role="status"
      className={cn("text-bk-muted flex items-center gap-1.5 text-xs", className)}
    >
      {state === "saving" ? (
        <Loader2
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      ) : (
        <Check className="size-3.5 shrink-0" aria-hidden />
      )}
      {state === "saving" ? t("saving") : t("saved")}
    </span>
  );
}
