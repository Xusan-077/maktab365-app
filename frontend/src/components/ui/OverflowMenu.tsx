"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface OverflowMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Yoqib-o'chiriladigan rejim (`menuitemcheckbox`); berilmasa oddiy harakat. */
  pressed?: boolean;
  testId?: string;
}

export interface OverflowMenuProps {
  items: readonly OverflowMenuItem[];
  /** "⋯" tugmasi yorlig'i (ekran o'qigichlar uchun). */
  label: string;
  /** Menyu tugmaning ustida (`top`, pastki panel) yoki ostida (`bottom`, sarlavha). */
  placement?: "top" | "bottom";
  /** Tugma ko'rinishi: `icon` — 44×44, `action` — pastki panel tugmasi (ikonka + matn). */
  trigger?: "icon" | "action";
  testId?: string;
  className?: string;
}

/**
 * "⋯" menyusi: joy yetmagan yoki ikkinchi darajali harakatlar. Tashqariga bosish va Esc yopadi,
 * tanlangach ham yopiladi; menyu ochilganda birinchi element fokus oladi.
 */
export function OverflowMenu({
  items,
  label,
  placement = "bottom",
  trigger = "icon",
  testId,
  className,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={trigger === "icon" ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid={testId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "text-foreground hover:bg-subtle transition-colors",
          trigger === "icon"
            ? "inline-flex size-11 items-center justify-center rounded-xl"
            : "flex h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold",
          open && "bg-subtle",
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
        {trigger === "action" && label}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "border-border bg-surface absolute right-0 z-40 w-60 rounded-xl border p-1 shadow-lg",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role={item.pressed === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.pressed}
              data-testid={item.testId}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "hover:bg-subtle flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium",
                item.pressed && "text-brand-text",
              )}
            >
              <span className="text-muted grid size-5 shrink-0 place-items-center">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
