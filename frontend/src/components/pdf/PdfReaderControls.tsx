"use client";

import type { ReactNode } from "react";
import {
  Highlighter,
  Keyboard,
  Maximize,
  Minimize,
  Moon,
  NotebookPen,
  ScanSearch,
  Search,
  Sun,
  Sunrise,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
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
  /** Belgilash rejimi (highlight) va barcha belgilar ro'yxati. */
  drawing?: boolean;
  onDrawing?: () => void;
  annotationCount?: number;
  onAnnotations?: () => void;
  /** Ikonka yonida matn ham ko'rsatiladi (mobil "Ko'rinish" sheet'i); default — faqat ikonka. */
  labels?: boolean;
  /** Dialog ochadigan yoki rejimni o'zgartirgan tugma bosilgach (sheet'ni yopish uchun). */
  onAfter?: () => void;
  /** Ko'rinadigan tugmalar to'plami: `view` — ko'rinish sozlamalari; `tools` — qidiruv, belgilar. */
  only?: "view" | "tools";
  className?: string;
}

function Control({
  label,
  showLabel,
  pressed,
  testId,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  showLabel: boolean;
  pressed?: boolean;
  testId: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={showLabel ? undefined : label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      onClick={onClick}
      className={cn(
        "text-foreground hover:bg-subtle inline-flex items-center rounded-xl text-sm font-semibold transition-colors",
        showLabel ? "min-h-12 w-full justify-start gap-3 px-3" : "size-11 justify-center",
        pressed && "bg-brand-soft text-brand-text",
      )}
    >
      {children}
      {showLabel && <span className="min-w-0 flex-1 text-left">{label}</span>}
    </button>
  );
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
  drawing = false,
  onDrawing,
  annotationCount = 0,
  onAnnotations,
  labels = false,
  onAfter,
  only,
  className,
}: PdfReaderControlsProps) {
  const t = useTranslations("pdfBooks.controls");
  const ToneIcon = TONE_ICON[tone];
  const after = (action: () => void) => () => {
    action();
    onAfter?.();
  };
  const tools = only !== "view";
  const view = only !== "tools";
  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        labels ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-0.5",
        className,
      )}
    >
      {tools && onSearch && (
        <Control
          label={t("find")}
          showLabel={labels}
          testId="pdf-find-open"
          shortcut="Control+F"
          onClick={after(onSearch)}
        >
          <Search className="size-5" aria-hidden />
        </Control>
      )}
      {tools && onDrawing && (
        <Control
          label={t(drawing ? "highlightOff" : "highlightOn")}
          showLabel={labels}
          pressed={drawing}
          testId="pdf-highlight"
          onClick={after(onDrawing)}
        >
          <Highlighter className="size-5" aria-hidden />
        </Control>
      )}
      {tools && onAnnotations && annotationCount > 0 && (
        <Control
          label={t("annotations", { count: annotationCount })}
          showLabel={labels}
          testId="pdf-annotations-open"
          onClick={after(onAnnotations)}
        >
          <NotebookPen className="size-5" aria-hidden />
        </Control>
      )}
      {view && (
        <>
          <Control
            label={t("tone", { tone: t(`tones.${tone}`) })}
            showLabel={labels}
            testId="pdf-tone"
            shortcut="T"
            onClick={onTone}
          >
            <ToneIcon className="size-5" aria-hidden />
          </Control>
          <Control
            label={t(fit === "page" ? "fitWidth" : "fitPage")}
            showLabel={labels}
            pressed={fit === "page"}
            testId="pdf-fit"
            onClick={onFit}
          >
            <ScanSearch className="size-5" aria-hidden />
          </Control>
          <Control
            label={t(zoom > 1 ? "zoomOut" : "zoomIn")}
            showLabel={labels}
            pressed={zoom > 1}
            testId="pdf-zoom"
            shortcut="Z"
            onClick={onZoom}
          >
            <span aria-hidden className="grid size-5 place-items-center text-sm tabular-nums">
              {zoom}×
            </span>
          </Control>
          {fullscreenSupported && (
            <Control
              label={t(fullscreen ? "exitFullscreen" : "fullscreen")}
              showLabel={labels}
              pressed={fullscreen}
              testId="pdf-fullscreen"
              shortcut="F"
              onClick={after(onFullscreen)}
            >
              {fullscreen ? (
                <Minimize className="size-5" aria-hidden />
              ) : (
                <Maximize className="size-5" aria-hidden />
              )}
            </Control>
          )}
          <Control
            label={t("shortcuts")}
            showLabel={labels}
            testId="pdf-shortcuts"
            shortcut="?"
            onClick={after(onShortcuts)}
          >
            <Keyboard className="size-5" aria-hidden />
          </Control>
        </>
      )}
    </div>
  );
}
