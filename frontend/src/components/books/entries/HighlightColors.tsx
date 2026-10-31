"use client";

import { useTranslations } from "next-intl";
import { colorLabelKey, HIGHLIGHT_COLORS } from "@/lib/books/annotations";
import { cn } from "@/lib/utils/cn";

interface Props {
  value?: string | null;
  onChange: (color: string) => void;
  label: string;
}

/** Belgilash rangini tanlash (radiogroup). */
export function HighlightColors({ value, onChange, label }: Props) {
  const t = useTranslations("books.workspace.colors");
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5">
      {HIGHLIGHT_COLORS.map((color) => {
        const selected = value?.toLowerCase() === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(colorLabelKey(color))}
            title={t(colorLabelKey(color))}
            onClick={() => onChange(color)}
            className="flex size-9 items-center justify-center rounded-full sm:size-8"
          >
            <span
              className={cn(
                "size-5 rounded-full border border-black/15 transition-transform",
                selected && "ring-foreground ring-offset-surface scale-110 ring-2 ring-offset-2",
              )}
              style={{ backgroundColor: color }}
            />
          </button>
        );
      })}
    </div>
  );
}
