"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { TEXT_SIZES } from "@/lib/utils/preferences";
import { usePreferencesStore } from "@/stores/preferences.store";

const sampleSizes = { s: "text-xs", m: "text-sm", l: "text-base" } as const;

export function TextSizeControl({ className }: { className?: string }) {
  const t = useTranslations("textSize");
  const textSize = usePreferencesStore((state) => state.textSize);
  const setTextSize = usePreferencesStore((state) => state.setTextSize);

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "border-border bg-surface inline-flex rounded-lg border p-0.5 shadow-xs",
        className,
      )}
    >
      {TEXT_SIZES.map((size) => (
        <button
          key={size}
          type="button"
          aria-pressed={textSize === size}
          aria-label={t(size)}
          title={t(size)}
          onClick={() => setTextSize(size)}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-md font-semibold uppercase transition-colors",
            sampleSizes[size],
            textSize === size
              ? "bg-primary-soft text-primary-soft-foreground"
              : "text-muted hover:bg-subtle hover:text-foreground",
          )}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
