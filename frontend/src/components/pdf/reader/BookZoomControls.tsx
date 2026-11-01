"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { DEFAULT_ZOOM, formatZoom, MAX_ZOOM, MIN_ZOOM, nudgeZoom } from "@/lib/pdf/zoom";
import { cn } from "@/lib/utils/cn";
import { READER_ICON_BUTTON } from "./reader-styles";

/**
 * O'qish oynasi sarlavhasidagi zoom guruhi (ikkala rejimda): −, foiz, +, «Moslash» (= 100%). Aa
 * menyusi va klaviatura (+ − 0) bilan bitta holat (`reader-prefs.store` `zoom`). `compact` — telefon:
 * foiz yozuvi tor, «Moslash» faqat ikonka.
 */
export function BookZoomControls({
  zoom,
  onZoom,
  onNudge,
  className,
  compact = false,
}: {
  zoom: number;
  onZoom: (zoom: number) => void;
  /** −/+ (25% qadam): berilsa animatsiya davomida ketma-ket bosishlar ham yig'iladi. */
  onNudge?: (direction: 1 | -1) => void;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("pdfBooks.appearance");
  return (
    <div
      role="group"
      aria-label={t("zoom")}
      data-testid="book-zoom"
      className={cn("border-ds-line rounded-ds-sm flex items-center border", className)}
    >
      <button
        type="button"
        aria-label={t("zoomOut")}
        aria-keyshortcuts="-"
        disabled={zoom <= MIN_ZOOM}
        onClick={() => (onNudge ? onNudge(-1) : onZoom(nudgeZoom(zoom, -1)))}
        className={cn(READER_ICON_BUTTON, "disabled:opacity-40")}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span
        aria-live="polite"
        data-testid="book-zoom-value"
        className={cn(
          "text-center font-semibold tabular-nums",
          compact ? "w-10 text-xs" : "w-12 text-sm",
        )}
      >
        {formatZoom(zoom)}
      </span>
      <button
        type="button"
        aria-label={t("zoomIn")}
        aria-keyshortcuts="+"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => (onNudge ? onNudge(1) : onZoom(nudgeZoom(zoom, 1)))}
        className={cn(READER_ICON_BUTTON, "disabled:opacity-40")}
      >
        <Plus className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("fitLabel")}
        aria-keyshortcuts="0"
        data-testid="book-zoom-fit"
        aria-pressed={zoom === DEFAULT_ZOOM}
        onClick={() => onZoom(DEFAULT_ZOOM)}
        className={cn(READER_ICON_BUTTON, !compact && "w-auto gap-1.5 px-3 text-sm font-semibold")}
      >
        <Maximize2 className="size-4" aria-hidden />
        {!compact && <span>{t("fit")}</span>}
      </button>
    </div>
  );
}
