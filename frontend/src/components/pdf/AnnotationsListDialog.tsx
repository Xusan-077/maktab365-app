"use client";

import { useState } from "react";
import { Smartphone, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Annotation } from "@/lib/pdf/annotations";

export interface AnnotationsListProps {
  items: Annotation[];
  onPick: (annotation: Annotation) => void;
  /** Bitta belgini o'chirish (chaqiruvchi «Qaytarish» taklif qiladi). */
  onRemove?: (annotation: Annotation) => void;
  /** Kitobdagi barcha yozuvlarni (belgilar + chizmalar) o'chirish — tasdiqlangandan keyin. */
  onClearAll?: () => void;
  /** Kitobda chizma bor (belgi bo'lmasa ham «Hammasini o'chirish» ko'rinadi). */
  hasDrawings?: boolean;
  className?: string;
}

/**
 * Kitobdagi barcha belgilar va eslatmalar ro'yxati: bosilsa shu betga o'tadi, savat — o'chiradi.
 * Pastda — hammasini o'chirish (ikki bosqichli tasdiq). Yozuvlar faqat shu qurilmada saqlanadi.
 */
export function AnnotationsList({
  items,
  onPick,
  onRemove,
  onClearAll,
  hasDrawings = false,
  className,
}: AnnotationsListProps) {
  const t = useTranslations("pdfBooks.annotations");
  const [confirming, setConfirming] = useState(false);
  const canClear = Boolean(onClearAll) && (items.length > 0 || hasDrawings);

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-muted text-sm">{t("empty")}</p>
      ) : (
        <ul className={className ?? "-mx-2"} data-testid="annotations-list">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-1">
              <button
                type="button"
                onClick={() => onPick(item)}
                className="hover:bg-subtle flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-2 text-left"
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
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={t("deleteOne", { page: item.page })}
                  title={t("delete")}
                  data-testid="annotation-list-delete"
                  className="text-muted hover:bg-subtle hover:text-danger inline-flex size-11 shrink-0 items-center justify-center rounded-lg"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted flex items-center gap-1.5 text-xs" data-testid="annotations-local">
        <Smartphone className="size-3.5 shrink-0" aria-hidden />
        {t("localOnly")}
      </p>

      {canClear &&
        (confirming ? (
          <div
            role="alertdialog"
            aria-labelledby="annotations-clear-title"
            aria-describedby="annotations-clear-text"
            className="border-border rounded-lg border p-3"
            data-testid="annotations-clear-confirm"
          >
            <p id="annotations-clear-title" className="text-sm font-medium">
              {t("clearAllTitle")}
            </p>
            <p id="annotations-clear-text" className="text-muted mt-1 text-sm">
              {t("clearAllText")}
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} autoFocus>
                {t("cancel")}
              </Button>
              <Button
                variant="danger"
                data-testid="annotations-clear-yes"
                onClick={() => {
                  setConfirming(false);
                  onClearAll?.();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                {t("clearAllConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="self-start"
            data-testid="annotations-clear-all"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            {t("clearAll")}
          </Button>
        ))}
    </div>
  );
}
