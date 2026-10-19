"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { useToastStore, type Toast as ToastData, type ToastVariant } from "@/stores/toast.store";

const AUTO_DISMISS_MS = 5000;

const icons = { info: Info, success: CheckCircle2, error: AlertCircle } satisfies Record<
  ToastVariant,
  unknown
>;
const iconColors: Record<ToastVariant, string> = {
  info: "text-link",
  success: "text-success",
  error: "text-danger",
};

function ToastItem({ toast }: { toast: ToastData }) {
  const t = useTranslations("ui");
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = icons[toast.variant];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className="border-border bg-surface pointer-events-auto flex [animation:ui-pop-in_0.2s_ease-out] items-start gap-3 rounded-xl border p-4 shadow-lg"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColors[toast.variant])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{toast.title}</p>
        {toast.description && <p className="text-muted mt-0.5 text-sm">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={t("dismiss")}
        className="text-muted hover:bg-subtle hover:text-foreground -m-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Ilova ildizida bir marta chizing; xabarlar `useToast()` orqali beriladi. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-96 lg:bottom-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
