"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { DEFAULT_ZOOM, formatZoom, MAX_ZOOM, MIN_ZOOM, nudgeZoom } from "@/lib/pdf/zoom";
import { cn } from "@/lib/utils/cn";
import { READER_ICON_BUTTON } from "./reader-styles";

/**
 * Kitob rejimidagi kichik zoom guruhi (sarlavhada): −, foiz, +, «Moslash». Aa menyusi va klaviatura
 * (+ − 0) bilan bitta holat (`reader-prefs.store` `zoom`).
 */
export function BookZoomControls({
  zoom,
  onZoom,
  className,
}: {
  zoom: number;
  onZoom: (zoom: number) => void;
  className?: string;
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
        onClick={() => onZoom(nudgeZoom(zoom, -1))}
        className={cn(READER_ICON_BUTTON, "disabled:opacity-40")}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span
        aria-live="polite"
        data-testid="book-zoom-value"
        className="w-12 text-center text-sm font-semibold tabular-nums"
      >
        {formatZoom(zoom)}
      </span>
      <button
        type="button"
        aria-label={t("zoomIn")}
        aria-keyshortcuts="+"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => onZoom(nudgeZoom(zoom, 1))}
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
        className={cn(READER_ICON_BUTTON, "w-auto gap-1.5 px-3 text-sm font-semibold")}
      >
        <Maximize2 className="size-4" aria-hidden />
        <span>{t("fit")}</span>
      </button>
    </div>
  );
}
