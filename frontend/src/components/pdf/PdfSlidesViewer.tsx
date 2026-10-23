"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { clampPage } from "@/lib/pdf/page-nav";
import { saveSlidesProgress } from "@/lib/pdf/slides";
import { swipeDirection } from "@/lib/pdf/swipe";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { useSlidesDocument } from "./usePdfDocument";

export interface PdfSlidesViewerProps {
  bookId: string;
  chapterId: string;
  /** Bo'lim sarlavhasi (dialog nomi). */
  title: string;
  /** Serverdagi slaydlar soni (hujjat ochilguncha ko'rsatiladi). */
  slideCount: number;
  /** Joriy slayd (1 dan). */
  slide: number;
  onSlide: (slide: number) => void;
  /** Yopish: kitobdagi joriy sahifada qoladi. */
  onClose: () => void;
  /** "Kitobga qaytish": shu bo'limning kitobdagi betiga o'tadi. */
  onBackToBook: () => void;
}

/** Imzolangan URL muddati tugagach birinchi xatoda yangi URL bilan hujjat qayta ochiladi. */
const MAX_AUTO_RELOADS = 1;

const control =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-35 motion-safe:active:scale-95";

/**
 * To'liq ekranli slayd ko'rgich (bo'lim prezentatsiyasi): bitta slayd ekranga sig'ib (contain),
 * ←/→/Home/End/Space, telefonda swipe, to'liq ekran (F) va "Kitobga qaytish". Native `<dialog>`:
 * fokus tuzog'i va Esc bilan yopish brauzer tomonidan. Joriy slayd URL'da (`?slide=N`) va
 * `localStorage` da eslab qolinadi.
 */
export function PdfSlidesViewer({
  bookId,
  chapterId,
  title,
  slideCount,
  slide,
  onSlide,
  onClose,
  onBackToBook,
}: PdfSlidesViewerProps) {
  const t = useTranslations("pdfBooks.slides");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const document_ = useSlidesDocument(bookId, chapterId);
  const { doc } = document_;
  const total = doc?.numPages ?? slideCount;
  const current = clampPage(slide, total);
  const [renderFailed, setRenderFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Ko'rgich faqat brauzerda chiziladi (SSR'siz), shuning uchun to'g'ridan-to'g'ri o'qiladi.
  const fullscreenSupported = Boolean(document.fullscreenEnabled);
  const reloads = useRef(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Hujjat ochilgach URL'dagi slayd 1..N ga tuzatiladi va eslab qolinadi.
  useEffect(() => {
    if (!doc) return;
    if (current !== slide) onSlide(current);
    saveSlidesProgress(chapterId, current);
  }, [doc, current, slide, chapterId, onSlide]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);

  const go = useCallback(
    (next: number) => {
      const target = clampPage(next, total);
      if (target !== current) onSlide(target);
    },
    [total, current, onSlide],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void dialogRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    touch.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
      event.timeStamp - start.at,
    );
    if (direction === "next") go(current + 1);
    if (direction === "prev") go(current - 1);
  };

  const retry = () => {
    reloads.current = 0;
    setRenderFailed(false);
    document_.reload();
  };
  const onRenderError = () => {
    if (reloads.current < MAX_AUTO_RELOADS) {
      reloads.current += 1;
      document_.reload();
    } else {
      setRenderFailed(true);
    }
  };

  const failed = (document_.error && !doc) || renderFailed;

  return (
    <dialog
      ref={dialogRef}
      aria-label={t("dialogLabel", { title })}
      data-testid="slides-viewer"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const key = event.key;
        if (key === "ArrowRight" || key === "PageDown" || key === " ") go(current + 1);
        else if (key === "ArrowLeft" || key === "PageUp") go(current - 1);
        else if (key === "Home") go(1);
        else if (key === "End") go(total);
        else if ((key === "f" || key === "F") && fullscreenSupported) toggleFullscreen();
        else return;
        // Kitob ko'rgichining ←/→ (window) tinglovchisi ishlamasin.
        event.preventDefault();
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden border-0 bg-transparent p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col bg-neutral-950">
        <header className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={onBackToBook}
            data-testid="slides-back"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{t("back")}</span>
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-medium">{title}</h2>
          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={t(fullscreen ? "exitFullscreen" : "fullscreen")}
              aria-pressed={fullscreen}
              data-testid="slides-fullscreen"
              className={control}
            >
              {fullscreen ? (
                <Minimize2 className="size-5" aria-hidden />
              ) : (
                <Maximize2 className="size-5" aria-hidden />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t("close")}
            data-testid="slides-close"
            className={control}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div
          className="min-h-0 flex-1 touch-pan-y px-2 select-none sm:px-6"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (touch.current = null)}
        >
          {failed ? (
            <div role="alert" className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-center text-sm text-red-300">
                {t(renderFailed ? "pageError" : "loadError")}
              </p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex min-h-11 items-center rounded-full bg-white/10 px-5 text-sm font-medium hover:bg-white/20 focus-visible:outline-white"
              >
                {t("retry")}
              </button>
            </div>
          ) : doc ? (
            <PdfPageCanvas
              doc={doc}
              fit="contain"
              pageNumber={current}
              label={t("slideLabel", { slide: current, total })}
              onRendered={() => (reloads.current = 0)}
              onError={onRenderError}
            />
          ) : (
            <div
              role="status"
              aria-label={t("loading")}
              className="flex h-full items-center justify-center"
            >
              <div className="aspect-[16/9] w-full max-w-3xl animate-pulse rounded-md bg-white/10" />
            </div>
          )}
        </div>

        <footer
          role="toolbar"
          aria-label={t("toolbar")}
          className="flex items-center justify-center gap-4 px-3 py-3 sm:py-4"
        >
          <button
            type="button"
            className={control}
            aria-label={t("prev")}
            data-testid="slides-prev"
            disabled={current <= 1}
            onClick={() => go(current - 1)}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <p
            className="min-w-24 text-center text-sm tabular-nums"
            data-testid="slides-position"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">{t("position", { slide: current, total })}</span>
            <span aria-hidden>
              {current} / {total}
            </span>
          </p>
          <button
            type="button"
            className={control}
            aria-label={t("next")}
            data-testid="slides-next"
            disabled={current >= total}
            onClick={() => go(current + 1)}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
