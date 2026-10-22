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
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-10",
        selected
          ? "border-primary-600 bg-primary-soft text-primary-soft-foreground"
          : "border-border bg-surface text-foreground hover:border-primary-300 hover:bg-subtle",
        className,
      )}
      {...props}
    />
  );
}
