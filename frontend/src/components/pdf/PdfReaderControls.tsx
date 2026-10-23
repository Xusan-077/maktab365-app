"use client";

import { Keyboard, Maximize, Minimize, Moon, ScanSearch, Search, Sun, Sunrise } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { ReaderFit, ReaderTone, ReaderZoom } from "@/lib/pdf/reader-prefs";

const TONE_ICON: Record<ReaderTone, LucideIcon> = { light: Sun, sepia: Sunrise, dark: Moon };

export interface PdfReaderControlsProps {
  tone: ReaderTone;
  fit: ReaderFit;
  zoom: ReaderZoom;
  fullscreen: boolean;
  fullscreenSupported: boolean;
  onTone: () => void;
  onFit: () => void;
  onZoom: () => void;
  onFullscreen: () => void;
  onShortcuts: () => void;
  onSearch?: () => void;
}

/** Sahifa fon rejimi, moslash, zoom, to'liq ekran, qidiruv va yorliqlar: har biri ikonka tugma. */
export function PdfReaderControls({
  tone,
  fit,
  zoom,
  fullscreen,
  fullscreenSupported,
  onTone,
  onFit,
  onZoom,
  onFullscreen,
  onShortcuts,
  onSearch,
}: PdfReaderControlsProps) {
  const t = useTranslations("pdfBooks.controls");
  const ToneIcon = TONE_ICON[tone];
  return (
    <div role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-1">
      {onSearch && (
        <Button
          variant="ghost"
          size="icon"
          data-testid="pdf-find-open"
          aria-label={t("find")}
          aria-keyshortcuts="Control+F"
          onClick={onSearch}
        >
          <Search className="size-5" aria-hidden />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        data-testid="pdf-tone"
        aria-label={t("tone", { tone: t(`tones.${tone}`) })}
        aria-keyshortcuts="T"
        onClick={onTone}
      >
        <ToneIcon className="size-5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        data-testid="pdf-fit"
        aria-pressed={fit === "page"}
        aria-label={t(fit === "page" ? "fitWidth" : "fitPage")}
        onClick={onFit}
      >
        <ScanSearch className="size-5" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        data-testid="pdf-zoom"
        aria-pressed={zoom > 1}
        aria-label={t(zoom > 1 ? "zoomOut" : "zoomIn")}
        aria-keyshortcuts="Z"
        onClick={onZoom}
      >
        <span aria-hidden className="text-sm font-semibold tabular-nums">
          {zoom}×
        </span>
      </Button>
      {fullscreenSupported && (
        <Button
          variant="ghost"
          size="icon"
          data-testid="pdf-fullscreen"
          aria-pressed={fullscreen}
          aria-label={t(fullscreen ? "exitFullscreen" : "fullscreen")}
          aria-keyshortcuts="F"
          onClick={onFullscreen}
        >
          {fullscreen ? (
            <Minimize className="size-5" aria-hidden />
          ) : (
            <Maximize className="size-5" aria-hidden />
          )}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        data-testid="pdf-shortcuts"
        aria-label={t("shortcuts")}
        aria-keyshortcuts="?"
        onClick={onShortcuts}
      >
        <Keyboard className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
