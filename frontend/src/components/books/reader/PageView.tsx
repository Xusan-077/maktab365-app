"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { ImageOff, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useElementSize } from "@/hooks/useElementSize";
import type { BookPage } from "@/lib/books/api";
import { pagesToPrefetch } from "@/lib/books/reader";
import { swipeDirection } from "@/lib/pdf/swipe";
import { doubleTapZoom, wheelZoom } from "@/lib/pdf/zoom";
import { cn } from "@/lib/utils/cn";
import { BAR_INSET } from "./reader-styles";

const SIDE_INSET = 16;

export interface PageViewProps {
  title: string;
  pages: readonly BookPage[];
  page: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onStep: (direction: 1 | -1) => void;
  /** Bo'sh joyga bosilganda (panellarni ko'rsatish/yashirish). */
  onTap: () => void;
}

/** Bet kasr piksellarga yaxlitlanadi: zoom kichik o'zgarganda rasm "titramasin". */
function fitWidth(
  size: { width: number; height: number },
  page: Pick<BookPage, "width" | "height">,
): number {
  const maxWidth = Math.max(size.width - SIDE_INSET * 2, 120);
  const maxHeight = Math.max(size.height - BAR_INSET * 2, 160);
  return Math.floor(Math.min(maxWidth, (maxHeight * page.width) / page.height));
}

/**
 * Bet rasmi: butun bet ekranga sig'adi (zoom 1×), kattalashtirilganda konteyner scroll bo'ladi.
 * Joy oldindan egallanadi (rasm o'lchami ma'lum) — CLS yo'q; keyingi 2 bet oldindan yuklanadi.
 * Swipe faqat zoom 1× da; ikki marta bosish — 1×/2×; Ctrl+g'ildirak — zoom.
 */
export function PageView({ title, pages, page, zoom, onZoomChange, onStep, onTap }: PageViewProps) {
  const t = useTranslations("books.reader");
  const scroller = useRef<HTMLDivElement>(null);
  const size = useElementSize(scroller);
  const current = pages[page - 1];
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const zoomRef = useRef(zoom);
  const [attempt, setAttempt] = useState(0);
  // Yuklanish holati bet + urinish bo'yicha: boshqa betga o'tganda avtomatik tiklanadi.
  const imageKey = `${page}:${attempt}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Keyingi (va oldingi) betlar oldindan yuklanadi: varaqlash darhol.
  useEffect(() => {
    const targets = [...pagesToPrefetch(page, pages.length), page - 1];
    for (const number of targets) {
      const url = pages[number - 1]?.image;
      if (url) new window.Image().src = url;
    }
  }, [page, pages]);

  // Yangi betga o'tganda kattalashtirilgan ko'rinish boshiga qaytadi.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, left: 0 });
  }, [page]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onZoomChange(wheelZoom(zoomRef.current, event.deltaY));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [onZoomChange]);

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    swipeStart.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || zoomRef.current > 1) return;
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
      event.timeStamp - start.at,
    );
    if (direction) onStep(direction === "next" ? 1 : -1);
  };

  const width = size && current ? fitWidth(size, current) * zoom : 0;
  const ready = loadedKey === imageKey;
  const failed = failedKey === imageKey || (current && !current.image);

  return (
    <div
      ref={scroller}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(event) => {
        if (event.target === event.currentTarget) onTap();
      }}
      onDoubleClick={() => onZoomChange(doubleTapZoom(zoomRef.current))}
      className="flex min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain"
      style={{ paddingBlock: BAR_INSET, paddingInline: SIDE_INSET }}
    >
      {current && width > 0 && (
        <div
          className="bg-bk-paper relative m-auto shrink-0 overflow-hidden rounded-sm shadow-[0_1px_2px_rgb(0_0_0/0.08),0_12px_40px_-12px_rgb(0_0_0/0.28)]"
          style={{ width, aspectRatio: `${current.width} / ${current.height}` }}
        >
          {!ready && !failed && (
            <div
              role="status"
              aria-label={t("pageLoading")}
              className="bg-bk-line/40 absolute inset-0 animate-pulse"
            />
          )}
          {failed || !current.image ? (
            <div
              role="alert"
              className="text-bk-muted absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm"
            >
              <ImageOff className="size-8" aria-hidden />
              {t("pageError")}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFailedKey(null);
                  setAttempt((value) => value + 1);
                }}
              >
                <RotateCw className="size-4" aria-hidden />
                {t("retry")}
              </Button>
            </div>
          ) : (
            <Image
              key={imageKey}
              src={current.image}
              alt={t("pageAlt", { title, page })}
              width={current.width}
              height={current.height}
              sizes={`${Math.ceil(width)}px`}
              unoptimized
              priority
              draggable={false}
              onLoad={() => setLoadedKey(imageKey)}
              onError={() => setFailedKey(imageKey)}
              className={cn(
                "book-page-img block h-full w-full transition-opacity duration-200 select-none",
                ready ? "opacity-100" : "opacity-0",
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
