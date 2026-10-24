"use client";

import type { ReactNode } from "react";
import { CloudDownload, GalleryHorizontal, ListTree, Share2, Type, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { DEFAULT_ZOOM, formatZoom } from "@/lib/pdf/zoom";
import { cn } from "@/lib/utils/cn";
import { PdfToolbar } from "../PdfToolbar";

function Action({
  label,
  testId,
  pressed,
  onClick,
  children,
}: {
  label: string;
  testId?: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "text-foreground hover:bg-subtle flex h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors",
        pressed && "bg-brand-soft text-brand-text",
      )}
    >
      {children}
      {label}
    </button>
  );
}

export interface ReaderBottomBarProps {
  page: number;
  total: number;
  onGo: (page: number) => void;
  prevPage?: number | null;
  nextPage?: number | null;
  onPanel: () => void;
  onView: () => void;
  /** Joriy zoom (50%–300%) va keyingi pog'onaga o'tish. */
  zoom: number;
  onZoom: () => void;
  /** "Sahifalar" (thumbnail'lar) sheet'i. */
  onPages?: () => void;
  onOffline?: () => void;
  onShare: () => void;
}

/**
 * Mobil pastki panel (suzuvchi): sahifa tugmalari va «Mundarija / Ko'rinish / Zoom / ⋯». Kamroq
 * ishlatiladiganlari («Sahifalar», «Oflayn», «Ulashish») — «⋯» menyusida.
 */
export function ReaderBottomBar({
  page,
  total,
  onGo,
  prevPage,
  nextPage,
  onPanel,
  onView,
  zoom,
  onZoom,
  onPages,
  onOffline,
  onShare,
}: ReaderBottomBarProps) {
  const t = useTranslations("pdfBooks.reader");
  const more: OverflowMenuItem[] = [
    ...(onPages
      ? [
          {
            id: "pages",
            label: t("pages"),
            icon: <GalleryHorizontal className="size-5" aria-hidden />,
            testId: "pdf-pages-open",
            onSelect: onPages,
          },
        ]
      : []),
    ...(onOffline
      ? [
          {
            id: "offline",
            label: t("offline"),
            icon: <CloudDownload className="size-5" aria-hidden />,
            testId: "pdf-offline-open",
            onSelect: onOffline,
          },
        ]
      : []),
    {
      id: "share",
      label: t("share"),
      icon: <Share2 className="size-5" aria-hidden />,
      testId: "pdf-share",
      onSelect: onShare,
    },
  ];
  return (
    <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 lg:hidden print:hidden">
      <div className="bg-surface flex flex-col gap-1.5 rounded-[1.25rem] p-2 shadow-2xl">
        <PdfToolbar
          page={page}
          total={total}
          onGo={onGo}
          prevPage={prevPage}
          nextPage={nextPage}
          variant="bar"
        />
        <div className="border-border grid grid-cols-4 gap-1 border-t pt-1.5">
          <Action label={t("panel")} testId="pdf-toc-open" onClick={onPanel}>
            <ListTree className="size-5" aria-hidden />
          </Action>
          <Action label={t("view")} testId="pdf-view-open" onClick={onView}>
            <Type className="size-5" aria-hidden />
          </Action>
          <Action
            label={zoom !== DEFAULT_ZOOM ? formatZoom(zoom) : t("zoom")}
            testId="pdf-zoom-bar"
            pressed={zoom !== DEFAULT_ZOOM}
            onClick={onZoom}
          >
            <ZoomIn className="size-5" aria-hidden />
          </Action>
          <OverflowMenu
            label={t("more")}
            items={more}
            placement="top"
            trigger="action"
            testId="pdf-bar-more"
          />
        </div>
      </div>
    </div>
  );
}
