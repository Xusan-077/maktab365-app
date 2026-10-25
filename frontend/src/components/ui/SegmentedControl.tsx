"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  testId?: string;
}

export interface SegmentedControlProps<T extends string> {
  legend: ReactNode;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Sarlavha ko'rinmasin (faqat ekran o'qigich uchun). */
  hideLegend?: boolean;
  className?: string;
}

/**
 * Bir nechta variantdan bittasi: native radio guruhi (strelkalar bilan almashish, forma semantikasi
 * brauzerdan), ko'rinishi — segmentli tugmalar.
 */
export function SegmentedControl<T extends string>({
  legend,
  value,
  options,
  onChange,
  hideLegend = false,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <legend className={cn("mb-2 text-sm font-semibold", hideLegend && "sr-only")}>
        {legend}
      </legend>
      <div
        className="bg-ds-canvas rounded-ds-sm grid gap-1 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              data-testid={option.testId}
              className={cn(
                "relative flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[0.625rem] px-2 text-center text-sm transition-colors",
                "has-[:focus-visible]:ring-ds-accent has-[:focus-visible]:ring-2",
                checked
                  ? "bg-ds-surface text-ds-ink font-bold shadow-sm"
                  : "text-ds-muted hover:text-ds-ink font-medium",
                option.disabled && "pointer-events-none opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.icon}
              <span className="min-w-0">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
