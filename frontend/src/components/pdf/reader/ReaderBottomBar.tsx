"use client";

import type { ReactNode } from "react";
import { CloudDownload, ListTree, Share2, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfToolbar } from "../PdfToolbar";

function Action({
  label,
  testId,
  onClick,
  children,
}: {
  label: string;
  testId?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="text-foreground hover:bg-subtle flex h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors"
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
  onPanel: () => void;
  onView: () => void;
  onOffline?: () => void;
  onShare: () => void;
}

/** Mobil pastki panel (suzuvchi): sahifa tugmalari va «Mundarija / Ko'rinish / Oflayn / Ulashish». */
export function ReaderBottomBar({
  page,
  total,
  onGo,
  onPanel,
  onView,
  onOffline,
  onShare,
}: ReaderBottomBarProps) {
  const t = useTranslations("pdfBooks.reader");
  return (
    <div className="fixed inset-x-3 bottom-4 z-20 lg:hidden print:hidden">
      <div className="bg-surface flex flex-col gap-1.5 rounded-[1.25rem] p-2 shadow-2xl">
        <PdfToolbar page={page} total={total} onGo={onGo} variant="bar" />
        <div className="border-border grid grid-cols-4 gap-1 border-t pt-1.5">
          <Action label={t("panel")} testId="pdf-toc-open" onClick={onPanel}>
            <ListTree className="size-5" aria-hidden />
          </Action>
          <Action label={t("view")} testId="pdf-view-open" onClick={onView}>
            <Type className="size-5" aria-hidden />
          </Action>
          {onOffline ? (
            <Action label={t("offline")} testId="pdf-offline-open" onClick={onOffline}>
              <CloudDownload className="size-5" aria-hidden />
            </Action>
          ) : (
            <span />
          )}
          <Action label={t("share")} testId="pdf-share" onClick={onShare}>
            <Share2 className="size-5" aria-hidden />
          </Action>
        </div>
      </div>
    </div>
  );
}
