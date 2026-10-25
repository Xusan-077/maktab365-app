"use client";

import { useTranslations } from "next-intl";
import type { Annotation } from "@/lib/pdf/annotations";

/** Kitobdagi barcha belgilar va eslatmalar ro'yxati: bosilsa shu betga o'tadi. */
export function AnnotationsList({
  items,
  onPick,
  className,
}: {
  items: Annotation[];
  onPick: (annotation: Annotation) => void;
  className?: string;
}) {
  const t = useTranslations("pdfBooks.annotations");
  if (items.length === 0) return <p className="text-muted text-sm">{t("empty")}</p>;
  return (
    <ul className={className ?? "-mx-2"} data-testid="annotations-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="hover:bg-subtle flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left"
          >
            <span
              aria-hidden
              data-color={item.color}
              className="pdf-note-swatch mt-0.5 size-4 shrink-0 rounded-full border"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium tabular-nums">
                {t("page", { page: item.page })}
              </span>
              <span className="text-muted text-sm break-words">{item.note || t("noNote")}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
