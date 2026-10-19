import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tanlangan holat (filtr chiplari uchun) — `aria-pressed` sifatida beriladi. */
  selected?: boolean;
}

export function Chip({ selected = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-border bg-surface text-foreground hover:bg-subtle",
        className,
      )}
      {...props}
    />
  );
}
