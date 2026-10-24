"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  anchorOffset,
  clampZoom,
  doubleTapZoom,
  MIN_ZOOM,
  nextZoomStep,
  pinchZoom,
} from "@/lib/pdf/zoom";

interface Point {
  x: number;
  y: number;
}

interface PendingAnchor {
  ratio: number;
  left: number;
  focalX: number;
  focalY: number;
}

/** Pinch paytidagi oldindan ko'rish: canvas qayta chizilmaydi, CSS `scale` (barmoqlar markazida). */
export interface LiveZoom {
  scale: number;
  origin: string;
}

const distance = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
const center = (touches: TouchList): Point => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});

/**
 * O'qish oynasi zoom'i (1×–3×): tugma/klaviatura pog'onalari, ikki marta bosish va ikki barmoq
 * (pinch). Zoom o'zgarganda fokus nuqtasi (barmoqlar markazi yoki bosilgan joy) ekranda joyida
 * qoladi: gorizontal — sahifa konteyneri scroll'i, vertikal — oyna (to'liq ekranda — stage).
 *
 * Kattalashganda surish brauzerning o'zida (`overflow-x-auto` + `touch-pan-x touch-pan-y`);
 * pinch'ni brauzer bajarmaydi (`touch-action` da `pinch-zoom` yo'q), shuning uchun ikki barmoqli
 * `touchmove` shu yerda o'qiladi va `preventDefault` qilinadi.
 */
export function useReaderZoom({
  stageRef,
  fullscreen,
}: {
  stageRef: RefObject<HTMLElement | null>;
  fullscreen: boolean;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [live, setLive] = useState<LiveZoom | null>(null);
  const [area, setArea] = useState<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(MIN_ZOOM);
  const pending = useRef<PendingAnchor | null>(null);
  /** Pinch bo'lgan teginish tap/swipe hisoblanmasin (PdfReader pointer handler'lari uchun). */
  const pinched = useRef(false);

  const applyZoom = useCallback((next: number, point?: Point) => {
    const previous = zoomRef.current;
    const target = clampZoom(next);
    if (target === previous) return;
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (scroller && content) {
      const box = scroller.getBoundingClientRect();
      const page = content.getBoundingClientRect();
      const x = point?.x ?? box.left + box.width / 2;
      const y = point?.y ?? Math.min(window.innerHeight / 2, page.bottom);
      pending.current = {
        ratio: target / previous,
        left: scroller.scrollLeft,
        focalX: x - box.left,
        focalY: Math.max(0, y - page.top),
      };
    }
    zoomRef.current = target;
    setZoom(target);
  }, []);

  useLayoutEffect(() => {
    const anchor = pending.current;
    if (!anchor) return;
    pending.current = null;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = anchorOffset(anchor.left, anchor.focalX, anchor.ratio);
    const dy = anchor.focalY * (anchor.ratio - 1);
    if (dy !== 0) (fullscreen ? stageRef.current : window)?.scrollBy?.(0, dy);
  }, [zoom, fullscreen, stageRef]);

  useEffect(() => {
    if (!area) return;
    let start: { distance: number; zoom: number; point: Point } | null = null;
    let scale = MIN_ZOOM;
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const content = contentRef.current?.getBoundingClientRect();
      const point = center(event.touches);
      start = { distance: distance(event.touches), zoom: zoomRef.current, point };
      scale = zoomRef.current;
      pinched.current = true;
      const origin = content ? `${point.x - content.left}px ${point.y - content.top}px` : "50% 50%";
      setLive({ scale: 1, origin });
    };
    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      scale = pinchZoom(start.zoom, start.distance, distance(event.touches));
      const ratio = scale / start.zoom;
      setLive((current) => (current ? { ...current, scale: ratio } : current));
    };
    const onEnd = (event: TouchEvent) => {
      if (!start || event.touches.length >= 2) return;
      const point = start.point;
      start = null;
      setLive(null);
      applyZoom(scale, point);
    };
    area.addEventListener("touchstart", onStart, { passive: true });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd);
    area.addEventListener("touchcancel", onEnd);
    return () => {
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
    };
  }, [area, applyZoom]);

  /** Tugma / klaviatura: keyingi pog'ona (1 → 1.5 → 2 → 3 → 1). */
  const stepZoom = useCallback(() => applyZoom(nextZoomStep(zoomRef.current)), [applyZoom]);
  /** Ikki marta bosish: 1× ↔ 2×, bosilgan joy ekranda qoladi. */
  const zoomAtTap = useCallback(
    (point: Point) => applyZoom(doubleTapZoom(zoomRef.current), point),
    [applyZoom],
  );
  /** Teginish boshlandi (asosiy barmoq): oldingi pinch belgisi tozalanadi. */
  const beginTouch = useCallback(() => {
    pinched.current = false;
  }, []);
  /** Shu teginishda pinch bo'ldimi (bo'lsa — tap ham, swipe ham emas). */
  const wasPinch = useCallback(() => pinched.current, []);

  /** Yangi sahifa: gorizontal surish boshiga. */
  const resetPan = useCallback(() => {
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
  }, []);

  return {
    zoom,
    live,
    stepZoom,
    zoomAtTap,
    beginTouch,
    wasPinch,
    resetPan,
    /** Teginishlar o'qiladigan sahifa maydoni (callback ref: element keyin paydo bo'lsa ham ulanadi). */
    areaRef: setArea,
    scrollerRef,
    contentRef,
  };
}
