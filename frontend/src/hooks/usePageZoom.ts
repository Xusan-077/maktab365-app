"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { clampZoomSmooth, doubleTapZoom, wheelZoomSmooth } from "@/lib/pdf/zoom";

interface Point {
  x: number;
  y: number;
}

/** Zoom o'zgarganda sahifaning `from` nuqtasi (ekran koordinatasi) yangi `to` nuqtaga tushishi kerak. */
interface Anchor {
  /** `from` nuqtaning sahifa chap/yuqori chetidan masofasi (zoom o'zgarishidan oldin, px). */
  offsetX: number;
  offsetY: number;
  ratio: number;
  to: Point;
}

const center = (touches: TouchList): Point => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});
const spread = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

export interface PageZoomOptions {
  scrollerRef: RefObject<HTMLElement | null>;
  /** Sahifa qutisi: zoom paytida fokus nuqtasi shu qutiga nisbatan saqlanadi. */
  pageRef: RefObject<HTMLElement | null>;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoom: (zoom: number) => void;
  /** Chizish rejimi: ikki barmoq va sudrab surish chizma qatlamiga qoladi. */
  drawMode: boolean;
}

/**
 * Bitta betli ko'rinish uchun zoom va surish: Ctrl/⌘+g'ildirak (trackpad pinch ham), ikki barmoq
 * (pinch), ikki marta bosish, zoom>1 da sichqoncha bilan sudrab surish. Zoom o'zgarganda barmoq/kursor
 * ostidagi nuqta joyida qoladi; pinch'da barmoqlar markazining siljishi ham surishga aylanadi.
 */
export function usePageZoom({
  scrollerRef,
  pageRef,
  zoom,
  minZoom,
  maxZoom,
  onZoom,
  drawMode,
}: PageZoomOptions) {
  const zoomRef = useRef(zoom);
  const pending = useRef<Anchor | null>(null);
  const limits = useRef({ minZoom, maxZoom });
  useEffect(() => {
    limits.current = { minZoom, maxZoom };
  }, [minZoom, maxZoom]);

  const zoomTo = useCallback(
    (next: number, from?: Point, to?: Point) => {
      const target = clampZoomSmooth(next, limits.current.minZoom, limits.current.maxZoom);
      const previous = zoomRef.current;
      if (Math.abs(target - previous) < 0.0005) return;
      const page = pageRef.current?.getBoundingClientRect();
      const box = scrollerRef.current?.getBoundingClientRect();
      if (page && box) {
        const origin = from ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        pending.current = {
          offsetX: origin.x - page.left,
          offsetY: origin.y - page.top,
          ratio: target / previous,
          to: to ?? origin,
        };
      }
      zoomRef.current = target;
      onZoom(target);
    },
    [onZoom, pageRef, scrollerRef],
  );

  // Yangi o'lchamdan keyin fokus nuqtasi `to` ga tushadigan qilib suriladi.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const anchor = pending.current;
    pending.current = null;
    const scroller = scrollerRef.current;
    const page = pageRef.current?.getBoundingClientRect();
    if (!anchor || !scroller || !page) return;
    const wantedLeft = anchor.to.x - anchor.offsetX * anchor.ratio;
    const wantedTop = anchor.to.y - anchor.offsetY * anchor.ratio;
    scroller.scrollLeft += page.left - wantedLeft;
    scroller.scrollTop += page.top - wantedTop;
  }, [zoom, scrollerRef, pageRef]);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const point = { x: event.clientX, y: event.clientY };
      zoomTo(wheelZoomSmooth(zoomRef.current, event.deltaY, event.deltaMode), point);
    };

    let pinch: { distance: number; center: Point } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (drawMode || event.touches.length !== 2) return;
      pinch = { distance: spread(event.touches), center: center(event.touches) };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const now = center(event.touches);
      const distance = spread(event.touches);
      const ratio = pinch.distance > 0 ? distance / pinch.distance : 1;
      zoomTo(zoomRef.current * ratio, pinch.center, now);
      // Zoom chegarada to'xtasa ham barmoqlar siljishi surishga aylanadi.
      if (Math.abs(ratio - 1) < 0.0005 || !pending.current) {
        const scroller = scrollerRef.current;
        if (scroller) {
          scroller.scrollLeft -= now.x - pinch.center.x;
          scroller.scrollTop -= now.y - pinch.center.y;
        }
      }
      pinch = { distance, center: now };
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null;
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", onTouchEnd);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollerRef, zoomTo, drawMode]);

  /** Sichqoncha bilan sudrab surish (zoom > 1; chizish rejimida emas). */
  const dragStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const scroller = scrollerRef.current;
      if (!scroller || event.pointerType !== "mouse" || event.button !== 0) return;
      if (drawMode || zoomRef.current <= 1) return;
      const scrollable =
        scroller.scrollWidth > scroller.clientWidth ||
        scroller.scrollHeight > scroller.clientHeight;
      if (!scrollable) return;
      dragStart.current = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
      };
      scroller.setPointerCapture(event.pointerId);
      scroller.dataset.panning = "";
    },
    [drawMode, scrollerRef],
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = dragStart.current;
      const scroller = scrollerRef.current;
      if (!start || !scroller) return;
      scroller.scrollLeft = start.left - (event.clientX - start.x);
      scroller.scrollTop = start.top - (event.clientY - start.y);
    },
    [scrollerRef],
  );
  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragStart.current) return;
      dragStart.current = null;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      delete scroller.dataset.panning;
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
    },
    [scrollerRef],
  );

  /** Ikki marta bosish: 1× ↔ 2×, bosilgan nuqta joyida qoladi. */
  const zoomAtPoint = useCallback(
    (point: Point) => zoomTo(doubleTapZoom(zoomRef.current), point),
    [zoomTo],
  );

  return {
    zoomTo,
    zoomAtPoint,
    panHandlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  };
}
