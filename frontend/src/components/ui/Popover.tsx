"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ochuvchi tugma: `aria-expanded`/`aria-controls` shu yerdan beriladi. */
  trigger: (props: {
    "aria-expanded": boolean;
    "aria-controls": string;
    onClick: () => void;
  }) => ReactNode;
  /** Panel nomi (ekran o'qigich): `role="dialog"`. */
  label: string;
  align?: "start" | "end";
  /** Panel tugmaning ostida (`bottom`) yoki ustida (`top`, sahifa pastidagi tugmalar uchun). */
  side?: "bottom" | "top";
  children: ReactNode;
  className?: string;
}

/**
 * Tugma ostidagi kichik panel (modal emas): tashqariga bosish va Esc yopadi, Esc'dan keyin fokus
 * tugmaga qaytadi; ochilganda panelning birinchi boshqaruv elementi fokus oladi.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  label,
  align = "end",
  side = "bottom",
  children,
  className,
}: PopoverProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panel.current
      ?.querySelector<HTMLElement>('input, button, [tabindex="0"]')
      ?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      root.current?.querySelector<HTMLElement>("[aria-controls]")?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={root} className="relative">
      {trigger({
        "aria-expanded": open,
        "aria-controls": panelId,
        onClick: () => onOpenChange(!open),
      })}
      <div
        ref={panel}
        id={panelId}
        role="dialog"
        aria-label={label}
        hidden={!open}
        className={cn(
          "border-ds-line bg-ds-surface text-ds-ink rounded-ds-lg absolute z-40 w-80 border p-4 shadow-lg",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          align === "end" ? "right-0" : "left-0",
          className,
        )}
      >
        {open && children}
      </div>
    </div>
  );
}
