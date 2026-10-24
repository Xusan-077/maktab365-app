"use client";

import { ArrowLeftRight, ArrowUpDown, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { READING_MODES, type ReadingMode } from "@/lib/pdf/reading-mode";
import { cn } from "@/lib/utils/cn";

const ICON: Record<ReadingMode, LucideIcon> = { h: ArrowLeftRight, v: ArrowUpDown };
const LABEL = { h: "modeH", v: "modeV" } as const;

/** O'qish rejimi: segmentli tanlov ↔ (gorizontal) / ↕ (vertikal). `labels` — matn bilan (mobil sheet). */
export function ReadingModeToggle({
  mode,
  onChange,
  labels = false,
}: {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
  labels?: boolean;
}) {
  const t = useTranslations("pdfBooks.reader");
  return (
    <div
      role="radiogroup"
      aria-label={t("modeLabel")}
      data-testid="pdf-mode"
      className={cn("bg-surface-2 flex shrink-0 rounded-xl p-1", labels ? "w-full" : "h-11")}
    >
      {READING_MODES.map((value) => {
        const Icon = ICON[value];
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labels ? undefined : t(LABEL[value])}
            title={labels ? undefined : t(LABEL[value])}
            data-testid={`pdf-mode-${value}`}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
              labels ? "min-h-11 flex-1 px-3" : "w-10",
              active ? "bg-surface text-brand-text shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[1.125rem]" aria-hidden />
            {labels && <span>{t(LABEL[value])}</span>}
          </button>
        );
      })}
    </div>
  );
}
