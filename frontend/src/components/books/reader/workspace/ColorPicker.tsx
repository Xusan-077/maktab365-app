"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { colorLabelKey, resolveColor } from "@/lib/books/annotations";
import type { BookTheme } from "@/lib/books/reader";
import { cn } from "@/lib/utils/cn";

export interface ColorPickerProps {
  label: string;
  colors: readonly string[];
  value: string;
  theme: BookTheme;
  /** Oxirgi ishlatilgan ranglar (asosiy palitradan tashqari bo'lsa ham ko'rsatiladi). */
  recent?: readonly string[];
  onChange: (color: string) => void;
}

/** Rang tanlash (radiogroup): ko'rinadigan matn yo'q, har bir rang `aria-label` bilan nomlanadi. */
export function ColorPicker({
  label,
  colors,
  value,
  theme,
  recent = [],
  onChange,
}: ColorPickerProps) {
  const t = useTranslations("books.workspace.colors");
  const extras = recent.filter((color) => !colors.includes(color)).slice(0, 3);
  const all = [...colors, ...extras];

  const name = (color: string) => {
    const key = colorLabelKey(color);
    return t.has(key) ? t(key) : color;
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1">
      {all.map((color) => {
        const selected = color === value;
        const swatch = resolveColor(color, theme);
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name(color)}
            title={name(color)}
            onClick={() => onChange(color)}
            className="group hover:bg-bk-accent-soft inline-flex size-11 items-center justify-center rounded-lg transition-colors sm:size-9"
          >
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-full border transition-transform group-active:scale-90",
                selected
                  ? "ring-bk-accent ring-offset-bk-bar ring-2 ring-offset-2"
                  : "border-bk-line",
              )}
              style={{ backgroundColor: swatch }}
            >
              {selected && (
                <Check
                  className="size-3.5 mix-blend-difference"
                  style={{ color: "#fff" }}
                  aria-hidden
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
