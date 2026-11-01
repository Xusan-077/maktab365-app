"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ImageOff, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfPageCanvas } from "@/components/pdf/PdfPageCanvas";
import { Button } from "@/components/ui/Button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useElementSize } from "@/hooks/useElementSize";
import { pagesToPrefetch } from "@/lib/books/reader";
import { pageCanvasScale, useNaturalPageSize } from "@/lib/books/pdf-page";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { PageRenderPool, type RenderRequest } from "@/lib/pdf/render-pool";
import { swipeDirection } from "@/lib/pdf/swipe";
import { doubleTapZoom, wheelZoom } from "@/lib/pdf/zoom";
import { BAR_INSET } from "./reader-styles";

const SIDE_INSET = 16;
/** Zoom to'xtagach shuncha vaqtdan keyin bet yangi aniqlikda qayta chiziladi. */
const ZOOM_RENDER_DELAY_MS = 180;
/** Keshda: joriy bet, keyingi 2 va oldingi bet. Qolganlari canvas xotirasidan tozalanadi. */
const POOL_CAPACITY = 4;
/** Imzolangan URL muddati tugab Range so'rovlari rad etilsa, hujjat shuncha vaqtda bir marta qayta ochiladi. */
const AUTO_RELOAD_COOLDOWN_MS = 60_000;

export interface PageViewProps {
  title: string;
  /** PDF.js hujjati; yuklanguncha `null`. */
  doc: PDFDocumentProxy | null;
  docLoading: boolean;
  docError: boolean;
  /** Hujjatni yangi imzolangan URL bilan qayta ochadi. */
  onReload: () => void;
  page: number;
  total: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onStep: (direction: 1 | -1) => void;
  /** Bo'sh joyga bosilganda (panellarni ko'rsatish/yashirish). */
  onTap: () => void;
  /** Chizish rejimi: swipe va ikki marta bosish bilan zoom o'chadi (chizishga xalaqit bermasin). */
  drawMode?: boolean;
  /** Qidiruv so'zi: betdagi moslashuvlar belgilanadi. */
  highlight?: string;
  /** Bet ustiga qatlam (chizma): bet qutisining o'lchami beriladi. */
  overlay?: (size: { width: number; height: number }) => ReactNode;
  /** Tashqaridan scroll qilish uchun (qatlam sahifani suradi). */
  scrollerRef?: RefObject<HTMLDivElement | null>;
}

/** Bet kasr piksellarga yaxlitlanadi: zoom kichik o'zgarganda bet "titramasin". */
function fitWidth(
  size: { width: number; height: number },
  page: { width: number; height: number },
): number {
  const maxWidth = Math.max(size.width - SIDE_INSET * 2, 120);
  const maxHeight = Math.max(size.height - BAR_INSET * 2, 160);
  return Math.floor(Math.min(maxWidth, (maxHeight * page.width) / page.height));
}

/**
 * Bet PDF.js bilan canvas'ga chiziladi: butun bet ekranga sig'adi (zoom 1×), kattalashtirilganda
 * konteyner scroll bo'ladi. Faqat joriy bet va keyingi 2 bet (oldindan) chiziladi, qolganlari
 * xotiradan tozalanadi (`PageRenderPool`). Zoom paytida bet CSS bilan kattalashadi, to'xtagach
 * (debounce) aniq qayta chiziladi. Swipe faqat zoom 1× da; ikki marta bosish — 1×/2×.
 */
export function PageView({
  title,
  doc,
  docLoading,
  docError,
  onReload,
  page,
  total,
  zoom,
  onZoomChange,
  onStep,
  onTap,
  drawMode = false,
  highlight,
  overlay,
  scrollerRef,
}: PageViewProps) {
  const t = useTranslations("books.reader");
  const ownScroller = useRef<HTMLDivElement>(null);
  const scroller = scrollerRef ?? ownScroller;
  const size = useElementSize(scroller);
  const natural = useNaturalPageSize(doc, page);
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const zoomRef = useRef(zoom);
  const lastAutoReload = useRef(0);
  const settledZoom = useDebouncedValue(zoom, ZOOM_RENDER_DELAY_MS);
  // Yuklanish holati bet + urinish bo'yicha: boshqa betga o'tganda avtomatik tiklanadi.
  const [attempt, setAttempt] = useState(0);
  const pageKey = `${page}:${attempt}`;
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Chizish navbati hujjatga bog'liq; hujjat almashsa/yopilsa canvas'lar bo'shatiladi.
  const pool = useMemo(() => (doc ? new PageRenderPool(doc, POOL_CAPACITY) : null), [doc]);
  useEffect(() => () => pool?.clear(), [pool]);

  // Yangi betga o'tganda kattalashtirilgan ko'rinish boshiga qaytadi.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, left: 0 });
  }, [page, scroller]);

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
  }, [onZoomChange, scroller]);

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" || drawMode) return;
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

  const fit = size && natural ? fitWidth(size, natural) : 0;
  const width = fit * zoom;
  // Canvas eni faqat zoom to'xtagach o'zgaradi; oraliqda CSS transform bilan kattalashadi.
  const renderWidth = Math.max(1, Math.floor(fit * settledZoom));
  const pageSize =
    natural && width > 0 ? { width, height: (width * natural.height) / natural.width } : null;
  const ready = renderedKey === pageKey;
  const failed = docError || failedKey === pageKey;

  // Joriy bet chizilgach keyingi 2 bet oldindan chiziladi (varaqlash darhol).
  useEffect(() => {
    if (!doc || !pool || !ready || fit <= 0) return;
    let cancelled = false;
    const requests: RenderRequest[] = [];
    void (async () => {
      for (const [index, target] of pagesToPrefetch(page, total).entries()) {
        try {
          const proxy = await doc.getPage(target);
          if (cancelled) return;
          const view = proxy.getViewport({ scale: 1 });
          const scale = pageCanvasScale(view, renderWidth, window.devicePixelRatio || 1);
          const request = pool.request(target, scale, index + 1);
          requests.push(request);
          request.promise.catch(() => undefined);
        } catch {
          return; // oldindan chizish ixtiyoriy: xato betga o'tganda ko'rinadi
        }
      }
    })();
    return () => {
      cancelled = true;
      for (const request of requests) request.cancel();
    };
  }, [doc, pool, ready, page, total, fit, renderWidth]);

  function onPageError() {
    setFailedKey(pageKey);
    const now = Date.now();
    if (now - lastAutoReload.current > AUTO_RELOAD_COOLDOWN_MS) {
      lastAutoReload.current = now;
      onReload();
    }
  }

  function retry() {
    setFailedKey(null);
    setAttempt((value) => value + 1);
    onReload();
  }

  return (
    <div
      ref={scroller}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(event) => {
        if (event.target === event.currentTarget) onTap();
      }}
      onDoubleClick={() => {
        if (!drawMode) onZoomChange(doubleTapZoom(zoomRef.current));
      }}
      className="flex min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain"
      style={{ paddingBlock: BAR_INSET, paddingInline: SIDE_INSET }}
    >
      {pageSize && (
        <div
          data-testid="book-page"
          data-page={page}
          className="bg-bk-paper relative m-auto shrink-0 overflow-hidden rounded-sm shadow-[0_1px_2px_rgb(0_0_0/0.08),0_12px_40px_-12px_rgb(0_0_0/0.28)]"
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          {doc && pool && !failed && (
            <div
              className="book-page-img origin-top-left select-none"
              style={{
                width: renderWidth,
                transform:
                  renderWidth === Math.floor(width) ? undefined : `scale(${width / renderWidth})`,
              }}
            >
              <PdfPageCanvas
                key={pageKey}
                doc={doc}
                pageNumber={page}
                label={t("pageAlt", { title, page })}
                pool={pool}
                variant="book"
                highlight={highlight}
                current
                onRendered={() => setRenderedKey(pageKey)}
                onError={onPageError}
              />
            </div>
          )}
          {!ready && !failed && (
            <div
              role="status"
              aria-label={t("pageLoading")}
              data-testid="book-page-loading"
              className="bg-bk-line/40 absolute inset-0 animate-pulse"
            />
          )}
          {failed && (
            <div
              role="alert"
              className="text-bk-muted absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm"
            >
              <ImageOff className="size-8" aria-hidden />
              {t("pageError")}
              <Button variant="secondary" size="sm" onClick={retry}>
                <RotateCw className="size-4" aria-hidden />
                {t("retry")}
              </Button>
            </div>
          )}
          {overlay && ready && overlay(pageSize)}
        </div>
      )}
      {!pageSize && (docLoading || docError || doc !== null) && (
        <div className="bg-bk-paper relative m-auto aspect-[1/1.414] w-full max-w-md shrink-0 rounded-sm">
          {docError ? (
            <div
              role="alert"
              className="text-bk-muted absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm"
            >
              <ImageOff className="size-8" aria-hidden />
              {t("pageError")}
              <Button variant="secondary" size="sm" onClick={onReload}>
                <RotateCw className="size-4" aria-hidden />
                {t("retry")}
              </Button>
            </div>
          ) : (
            <div
              role="status"
              aria-label={t("pageLoading")}
              className="bg-bk-line/40 absolute inset-0 animate-pulse"
            />
          )}
        </div>
      )}
    </div>
  );
}
