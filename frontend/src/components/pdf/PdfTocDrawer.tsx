"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils/cn";
import { currentTocItem, flattenToc, type TocChapter } from "@/lib/pdf/toc";

export interface PdfTocDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: readonly TocChapter[];
  /** Joriy sahifa: shu sahifaga to'g'ri keladigan bo'lim ajratib ko'rsatiladi. */
  page: number;
  onGo: (page: number) => void;
}

const MOBILE_QUERY = "(max-width: 639px)";

/** Mundarija paneli: mobilda pastdan, kattaroq ekranda o'ngdan; bo'limni bossa shu betga o'tadi. */
export function PdfTocDrawer({ open, onOpenChange, chapters, page, onGo }: PdfTocDrawerProps) {
  const t = useTranslations("pdfBooks.toc");
  const mobile = useMediaQuery(MOBILE_QUERY);
  const items = useMemo(() => flattenToc(chapters), [chapters]);
  const current = currentTocItem(items, page);
  const currentRef = useRef<HTMLButtonElement>(null);

  // Ochilganda joriy bo'lim ko'rinadigan joyga keltiriladi.
  useEffect(() => {
    if (open) currentRef.current?.scrollIntoView?.({ block: "center" });
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      placement={mobile ? "bottom" : "right"}
    >
      <nav aria-label={t("title")}>
        <ol className="flex flex-col gap-0.5" data-testid="pdf-toc">
          {items.map((item) => {
            const active = item.id === current?.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  ref={active ? currentRef : undefined}
                  aria-current={active ? "location" : undefined}
                  data-testid="pdf-toc-item"
                  onClick={() => {
                    onGo(item.page);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    item.level === 1 && "pl-8",
                    active
                      ? "bg-primary-soft text-primary-soft-foreground font-semibold"
                      : "hover:bg-subtle",
                  )}
                >
                  <span className="min-w-0 flex-1 text-pretty">{item.title}</span>
                  <span className="text-muted shrink-0 tabular-nums">
                    {t("page", { page: item.page })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </Dialog>
  );
}
