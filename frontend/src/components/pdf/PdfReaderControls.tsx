"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { cn } from "@/lib/utils/cn";
import type { ReaderFit, ReaderTone } from "@/lib/pdf/reader-prefs";
import { formatZoom, MIN_ZOOM, visibleCount } from "@/lib/pdf/zoom";

const TONE_ICON: Record<ReaderTone, LucideIcon> = { light: Sun, sepia: Sunrise, dark: Moon };

/** Ikonka tugma kengligi (`size-11` + oraliq): sarlavhaga nechta sig'ishini hisoblash uchun. */
const CONTROL_WIDTH = 46;
/** Joy yetmasa birinchi bo'lib "⋯" ga tushadiganlar oxirida (qidiruv — eng muhimi). */
const PRIORITY = [
  "find",
  "zoom",
  "fullscreen",
  "highlight",
  "annotations",
  "tone",
  "fit",
  "shortcuts",
] as const;
type ControlId = (typeof PRIORITY)[number];

export interface PdfReaderControlsProps {
  tone: ReaderTone;
  fit: ReaderFit;
  zoom: number;
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
  /**
   * Bir qatorda qoladi (desktop sarlavhasi): sig'maganlari ustuvorlik bo'yicha "⋯" menyusiga
   * tushadi. Kenglik `ResizeObserver` bilan o'lchanadi (bo'lmasa — hammasi ko'rinadi).
   */
  overflow?: boolean;
  /** Dialog ochadigan yoki rejimni o'zgartirgan tugma bosilgach (sheet'ni yopish uchun). */
  onAfter?: () => void;
  /** Ko'rinadigan tugmalar to'plami: `view` — ko'rinish sozlamalari; `tools` — qidiruv, belgilar. */
  only?: "view" | "tools";
  className?: string;
}

interface ControlItem {
  id: ControlId;
  label: string;
  icon: ReactNode;
  pressed?: boolean;
  testId: string;
  shortcut?: string;
  onClick: () => void;
}

function Control({ item, showLabel }: { item: ControlItem; showLabel: boolean }) {
  return (
    <button
      type="button"
      data-testid={item.testId}
      aria-label={showLabel ? undefined : item.label}
      aria-pressed={item.pressed}
      aria-keyshortcuts={item.shortcut}
      onClick={item.onClick}
      className={cn(
        "text-foreground hover:bg-subtle inline-flex shrink-0 items-center rounded-xl text-sm font-semibold transition-colors",
        showLabel ? "min-h-12 w-full justify-start gap-3 px-3" : "size-11 justify-center",
        item.pressed && "bg-brand-soft text-brand-text",
      )}
    >
      {item.icon}
      {showLabel && <span className="min-w-0 flex-1 text-left">{item.label}</span>}
    </button>
  );
}

/** Element kengligi (px); `ResizeObserver` yo'q muhitda (test, eski brauzer) — `null`. */
function useWidth(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
  return { ref, width };
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
  overflow = false,
  onAfter,
  only,
  className,
}: PdfReaderControlsProps) {
  const t = useTranslations("pdfBooks.controls");
  const { ref, width } = useWidth(overflow && !labels);
  const ToneIcon = TONE_ICON[tone];
  const after = (action: () => void) => () => {
    action();
    onAfter?.();
  };
  const tools = only !== "view";
  const view = only !== "tools";
  const icon = (Icon: LucideIcon) => <Icon className="size-5" aria-hidden />;

  // Ko'rinish tartibi; yashirish tartibi — `PRIORITY`.
  const items: ControlItem[] = [];
  if (tools && onSearch) {
    items.push({
      id: "find",
      label: t("find"),
      icon: icon(Search),
      testId: "pdf-find-open",
      shortcut: "Control+F",
      onClick: after(onSearch),
    });
  }
  if (tools && onDrawing) {
    items.push({
      id: "highlight",
      label: t(drawing ? "highlightOff" : "highlightOn"),
      icon: icon(Highlighter),
      pressed: drawing,
      testId: "pdf-highlight",
      onClick: after(onDrawing),
    });
  }
  if (tools && onAnnotations && annotationCount > 0) {
    items.push({
      id: "annotations",
      label: t("annotations", { count: annotationCount }),
      icon: icon(NotebookPen),
      testId: "pdf-annotations-open",
      onClick: after(onAnnotations),
    });
  }
  if (view) {
    items.push(
      {
        id: "tone",
        label: t("tone", { tone: t(`tones.${tone}`) }),
        icon: icon(ToneIcon),
        testId: "pdf-tone",
        shortcut: "T",
        onClick: onTone,
      },
      {
        id: "fit",
        label: t(fit === "page" ? "fitWidth" : "fitPage"),
        icon: icon(ScanSearch),
        pressed: fit === "page",
        testId: "pdf-fit",
        onClick: onFit,
      },
      {
        id: "zoom",
        label: t("zoomLevel", { level: formatZoom(zoom) }),
        icon: (
          <span aria-hidden className="grid h-5 min-w-5 place-items-center text-sm tabular-nums">
            {formatZoom(zoom)}
          </span>
        ),
        pressed: zoom > MIN_ZOOM,
        testId: "pdf-zoom",
        shortcut: "Z",
        onClick: onZoom,
      },
    );
    if (fullscreenSupported) {
      items.push({
        id: "fullscreen",
        label: t(fullscreen ? "exitFullscreen" : "fullscreen"),
        icon: icon(fullscreen ? Minimize : Maximize),
        pressed: fullscreen,
        testId: "pdf-fullscreen",
        shortcut: "F",
        onClick: after(onFullscreen),
      });
    }
    items.push({
      id: "shortcuts",
      label: t("shortcuts"),
      icon: icon(Keyboard),
      testId: "pdf-shortcuts",
      shortcut: "?",
      onClick: after(onShortcuts),
    });
  }

  if (labels) {
    return (
      <div role="group" aria-label={t("label")} className={cn("flex flex-col gap-1", className)}>
        {items.map((item) => (
          <Control key={item.id} item={item} showLabel />
        ))}
      </div>
    );
  }

  const count =
    overflow && width !== null ? visibleCount(items.length, width, CONTROL_WIDTH) : items.length;
  const shown = new Set(
    [...items]
      .sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id))
      .slice(0, count)
      .map((item) => item.id),
  );
  const hidden = items.filter((item) => !shown.has(item.id));

  return (
    <div
      ref={ref}
      role="group"
      aria-label={t("label")}
      className={cn(
        "flex items-center gap-0.5",
        overflow ? "min-w-0 flex-1 flex-nowrap justify-end" : "flex-wrap",
        className,
      )}
    >
      {items
        .filter((item) => shown.has(item.id))
        .map((item) => (
          <Control key={item.id} item={item} showLabel={false} />
        ))}
      <OverflowMenu
        label={t("more")}
        testId="pdf-controls-more"
        items={hidden.map((item) => ({
          id: item.id,
          label: item.label,
          icon: item.icon,
          pressed: item.pressed,
          testId: item.testId,
          onSelect: item.onClick,
        }))}
      />
    </div>
  );
}
