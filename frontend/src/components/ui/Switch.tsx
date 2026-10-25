"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  testId?: string;
  className?: string;
}

/** Yoqib-o'chirgich (`role="switch"`): butun qator bosiladi, balandligi kamida 44px. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  testId,
  className,
}: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "rounded-ds-sm flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-ds-muted block text-xs">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-ds-accent" : "bg-ds-line",
        )}
      >
        <span
          className={cn(
            "bg-ds-surface size-5 rounded-full shadow-sm transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
