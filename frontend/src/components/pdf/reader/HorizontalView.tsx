"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LiveZoom } from "@/hooks/useReaderZoom";
import { nextSpread, prevSpread, spreadPages, spreadStart } from "@/lib/pdf/reading-mode";
import { cn } from "@/lib/utils/cn";

/** Bet almashish animatsiyasi (ms) va siljish masofasi (px). */
const FLIP_MS = 180;
const FLIP_SHIFT = 28;

export interface RenderPageOptions {
  current: boolean;
  align: "start" | "center" | "end";
  /** Ko'rinmas, oldindan chizilayotgan bet: xatosi o'quvchini to'xtatmaydi. */
  prefetch?: boolean;
}

export interface HorizontalViewProps {
  page: number;
  total: number;
  /** 2 betlik yoyma (desktop, landshaft); aks holda bitta bet. */
  spread: boolean;
  zoom: number;
  live: LiveZoom | null;
  /** Ko'rinish balandligi (CSS): bet shu qutiga to'liq sig'adi. */
  height: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  onGo: (page: number) => void;
  /** `PdfPageCanvas` (`fit="contain"`) — belgilar qatlami va qidiruv belgilari bilan. */
  renderPage: (pageNumber: number, options: RenderPageOptions) => ReactNode;
}

/** Bir yoymaning slotlari (yoyma bo'lmasa bitta). `null` — bo'sh tomon (muqova yolg'iz o'ngda). */
const slotsOf = (page: number, total: number, spread: boolean) =>
  spreadPages(page, total, spread).map((pageNumber, index) => ({
    pageNumber,
    align: (spread ? (index === 0 ? "end" : "start") : "center") as RenderPageOptions["align"],
  }));

/**
 * Gorizontal (kitob kabi) o'qish: bitta bet yoki 2 betlik yoyma ekranga to'liq sig'adi. Oldingi va
 * keyingi yoyma ko'rinmas holda oldindan chiziladi: barcha betlar bitta ro'yxatda `p<N>` kaliti
 * bilan turadi, shuning uchun o'tilganda tayyor canvas qayta chizilmasdan ko'rinadi.
 * Zoom > 100% bo'lsa quti ichida ikki o'q bo'yicha suriladi (pan).
 */
export function HorizontalView({
  page,
  total,
  spread,
  zoom,
  live,
  height,
  scrollerRef,
  contentRef,
  onGo,
  renderPage,
}: HorizontalViewProps) {
  const t = useTranslations("pdfBooks.reader");
  const spreadRef = useRef<HTMLDivElement>(null);
  const start = spreadStart(page, spread);
  const prev = prevSpread(page, spread);
  const next = nextSpread(page, total, spread);

  // Slayd/fade: yo'nalish — bet raqami oshdimi; `prefers-reduced-motion` da yo'q.
  const shown = useRef(start);
  useLayoutEffect(() => {
    const previous = shown.current;
    shown.current = start;
    const element = spreadRef.current;
    if (previous === start || !element || typeof element.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const direction = start > previous ? 1 : -1;
    element.animate(
      [
        { transform: `translateX(${direction * FLIP_SHIFT}px)`, opacity: 0.35 },
        { transform: "none", opacity: 1 },
      ],
      { duration: FLIP_MS, easing: "ease-out" },
    );
  }, [start]);

  const current = slotsOf(page, total, spread);
  const slots = [
    ...current.map((slot, index) => ({
      ...slot,
      role: "current" as const,
      key: slot.pageNumber === null ? `blank-${index}` : `p${slot.pageNumber}`,
    })),
    ...[prev, next]
      .filter((value): value is number => value !== null)
      .flatMap((value) => slotsOf(value, total, spread))
      .filter((slot) => slot.pageNumber !== null)
      .map((slot) => ({ ...slot, role: "prefetch" as const, key: `p${slot.pageNumber}` })),
  ];
  const half = spread ? "w-1/2" : "w-full";
  const pair = spread && current.every((slot) => slot.pageNumber !== null);

  return (
    <div className="relative" data-testid="pdf-horizontal" data-spread={spread || undefined}>
      <div
        ref={scrollerRef}
        className={cn("flex", (zoom !== 1 || live) && "overflow-auto")}
        style={{ height }}
      >
        <div
          ref={contentRef}
          data-testid="pdf-zoom-content"
          data-zoom={zoom}
          className="relative m-auto shrink-0"
          style={{
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            ...(live && { transform: `scale(${live.scale})`, transformOrigin: live.origin }),
          }}
        >
          <div ref={spreadRef} className="relative flex size-full">
            {/* Bitta massiv: kalit (`p<N>`) bo'yicha DOM tuguni (chizilgan canvas) saqlanadi. */}
            {slots.map((slot) =>
              slot.pageNumber === null ? (
                <div key={slot.key} className={cn(half, "h-full")} />
              ) : slot.role === "current" ? (
                <div key={slot.key} data-slot="current" className={cn(half, "relative h-full")}>
                  {renderPage(slot.pageNumber, {
                    current: slot.pageNumber === page,
                    align: slot.align,
                  })}
                </div>
              ) : (
                <div
                  key={slot.key}
                  aria-hidden
                  data-slot="prefetch"
                  className={cn(half, "pointer-events-none invisible absolute inset-y-0 left-0")}
                >
                  {renderPage(slot.pageNumber, {
                    current: false,
                    align: slot.align,
                    prefetch: true,
                  })}
                </div>
              ),
            )}
            {pair && (
              <div
                aria-hidden
                className="pdf-spine pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2"
              />
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label={t("prev")}
        data-testid="pdf-edge-prev"
        disabled={prev === null}
        onClick={() => prev !== null && onGo(prev)}
        className="pdf-edge-button left-1 lg:left-3"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("next")}
        data-testid="pdf-edge-next"
        disabled={next === null}
        onClick={() => next !== null && onGo(next)}
        className="pdf-edge-button right-1 lg:right-3"
      >
        <ChevronRight className="size-6" aria-hidden />
      </button>
    </div>
  );
}
