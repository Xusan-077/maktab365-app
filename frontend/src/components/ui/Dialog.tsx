"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** `bottom` — mobil pastki sheet, `right` — o'ng tomondagi panel (drawer). */
  placement?: "center" | "bottom" | "right";
  children?: ReactNode;
  className?: string;
}

/** Native `<dialog>` + `showModal()`: focus trap, Esc bilan yopish va fokusni qaytarish brauzer tomonidan. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  placement = "center",
  children,
  className,
}: DialogProps) {
  const t = useTranslations("ui");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-placement={placement}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "bg-surface text-foreground backdrop:bg-overlay p-0 shadow-lg",
        placement === "center" &&
          "border-border m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border",
        placement === "bottom" &&
          "border-border mx-0 mt-auto mb-0 w-full max-w-none rounded-t-2xl border-t",
        placement === "right" &&
          "border-border my-0 mr-0 ml-auto h-dvh max-h-none w-full max-w-sm rounded-l-2xl border-l",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 overflow-y-auto p-5",
          placement === "right" ? "h-full" : "max-h-[85dvh]",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-muted mt-1 text-sm">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("close")}
            className="text-muted hover:bg-subtle hover:text-foreground -m-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
