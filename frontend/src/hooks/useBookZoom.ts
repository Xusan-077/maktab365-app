"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, useMotionValue, type AnimationPlaybackControls } from "framer-motion";
import {
  BOOK_PADDING,
  BOOK_PAN_ZOOM,
  clampPan,
  fitScale,
  panBounds,
  zoomAround,
  type Size,
} from "@/lib/pdf/book";
import { doubleTapZoom, MAX_ZOOM, MIN_ZOOM, wheelZoom } from "@/lib/pdf/zoom";

interface Point {
  x: number;
  y: number;
}

/** Zoom/fit animatsiyasi: so'nuvchi prujina (sakramaydi), ~300ms. */
const SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;
/** Ctrl+g'ildirak to'xtagach shuncha ms dan keyin zoom holatga yoziladi. */
const WHEEL_COMMIT_MS = 150;
/** Zoom tinchigach betlar shuncha ms dan keyin aniqroq qayta chiziladi. */
const RERENDER_DEBOUNCE_MS = 200;

const distance = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
const midpoint = (touches: TouchList): Point => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});

/**
 * Kitob rejimi zoom'i va pan'i: kitob joylashuvi (`book`) o'zgarmaydi, ko'rinish faqat GPU
 * transform'da (`scale` = «Moslash» × zoom, `x`/`y` — pan). Zoom holati umumiy store'da (`zoom`,
 * 1 = «Moslash»); tugma/klaviatura o'zgarishi prujina bilan, fokus nuqtasi (kursor, barmoqlar,
 * yo'q bo'lsa markaz) joyida qoladi. Pinch va Ctrl+g'ildirak harakat paytida transformni to'g'ridan
 * to'g'ri o'zgartiradi, qo'yib yuborilganda holatga yoziladi. Stage o'zgarsa (oyna, Mavzu paneli)
 * «Moslash» qayta hisoblanadi va kitob silliq o'tadi.
 */
export function useBookZoom({
  stage,
  book,
  zoom,
  setZoom,
  instant,
}: {
  stage: HTMLElement | null;
  /** Kitobning joylashuv o'lchami (transform'siz). */
  book: Size;
  zoom: number;
  setZoom: (zoom: number) => void;
  /** Animatsiyasiz (prefers-reduced-motion / sust qurilma). */
  instant: boolean;
}) {
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const stageCenter = useRef<Point | null>(null);
  const controls = useRef<AnimationPlaybackControls[]>([]);
  /** Keyingi zoom o'zgarishining fokus nuqtasi (stage markaziga nisbatan). */
  const focal = useRef<Point | null>(null);
  const initialized = useRef(false);
  /** Pinch / g'ildirak davom etmoqda: varaq ag'darish va pan to'xtaydi. */
  const live = useRef(false);

  const fit = fitScale(book, stageSize, BOOK_PADDING);
  const target = fit * zoom;

  const stop = useCallback(() => {
    for (const control of controls.current) control.stop();
    controls.current = [];
  }, []);

  // Stage o'lchami va markazi. Markaz siljisa (Mavzu paneli) kitob shu zahoti joyida qoladi, keyin
  // pastdagi effekt uni yangi markazga silliq olib boradi.
  useEffect(() => {
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const previous = stageCenter.current;
      stageCenter.current = center;
      if (previous && initialized.current) {
        x.set(x.get() - (center.x - previous.x));
        y.set(y.get() - (center.y - previous.y));
      }
      setStageSize({ width: rect.width, height: rect.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage, x, y]);

  const bounds = useCallback(
    (value: number) => panBounds(book, value, stageSize, BOOK_PADDING),
    [book, stageSize],
  );

  // Zoom yoki «Moslash» o'zgardi → yangi masshtab va pan (fokus nuqtasi joyida, chegaralar ichida).
  useLayoutEffect(() => {
    if (!book.width || !stageSize.width) return;
    const from = scale.get();
    const point = focal.current ?? { x: 0, y: 0 };
    focal.current = null;
    const pan = clampPan(
      zoomAround({ x: x.get(), y: y.get() }, point, from, target),
      bounds(target),
    );
    stop();
    if (instant || !initialized.current) {
      initialized.current = true;
      scale.set(target);
      x.set(pan.x);
      y.set(pan.y);
      return;
    }
    controls.current = [
      animate(scale, target, SPRING),
      animate(x, pan.x, SPRING),
      animate(y, pan.y, SPRING),
    ];
  }, [target, book.width, stageSize.width, instant, bounds, scale, x, y, stop]);

  useEffect(() => stop, [stop]);

  const toFocal = useCallback((client?: Point): Point | null => {
    const center = stageCenter.current;
    return client && center ? { x: client.x - center.x, y: client.y - center.y } : null;
  }, []);

  /** Aniq zoom (tugma, klaviatura, Aa): `client` — fokus nuqtasi (bo'lmasa markaz). */
  const zoomTo = useCallback(
    (next: number, client?: Point) => {
      focal.current = toFocal(client);
      setZoom(next);
    },
    [setZoom, toFocal],
  );

  /** Ikki marta bosish: «Moslash» ↔ 200%, bosilgan joy ekranda qoladi. */
  const toggleAt = useCallback(
    (client: Point) => zoomTo(doubleTapZoom(zoom), client),
    [zoom, zoomTo],
  );

  /** Pan (sichqoncha/barmoq/g'ildirak): chegaralar ichida, animatsiyasiz. */
  const panTo = useCallback(
    (next: Point) => {
      stop();
      const pan = clampPan(next, bounds(scale.get()));
      x.set(pan.x);
      y.set(pan.y);
    },
    [bounds, scale, x, y, stop],
  );

  /** Harakat paytidagi masshtab (holatga yozilmaydi): `client` atrofida. */
  const liveScale = useCallback(
    (next: number, client: Point | null, origin?: { pan: Point; scale: number; focal: Point }) => {
      if (!fit) return;
      stop();
      const value = Math.min(fit * MAX_ZOOM, Math.max(fit * MIN_ZOOM, next));
      const point = toFocal(client ?? undefined) ?? { x: 0, y: 0 };
      // Pinch: boshlang'ich nuqtaga nisbatan (barmoqlar siljisa kitob ham suriladi).
      const pan = origin
        ? {
            x: point.x - (origin.focal.x - origin.pan.x) * (value / origin.scale),
            y: point.y - (origin.focal.y - origin.pan.y) * (value / origin.scale),
          }
        : zoomAround({ x: x.get(), y: y.get() }, point, scale.get(), value);
      const clamped = clampPan(pan, bounds(value));
      scale.set(value);
      x.set(clamped.x);
      y.set(clamped.y);
    },
    [fit, toFocal, bounds, scale, x, y, stop],
  );

  const commitLive = useCallback(() => {
    live.current = false;
    if (fit) setZoom(scale.get() / fit);
  }, [fit, scale, setZoom]);

  // Ctrl/⌘+g'ildirak (va trackpad pinch'i): brauzer zoomi o'rniga kitob; oddiy g'ildirak — pan.
  useEffect(() => {
    if (!stage) return;
    let timer = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (!fit) return;
        live.current = true;
        const inside = stage.contains(event.target as Node);
        const current = scale.get() / fit;
        liveScale(
          fit * wheelZoom(current, event.deltaY),
          inside ? { x: event.clientX, y: event.clientY } : null,
        );
        window.clearTimeout(timer);
        timer = window.setTimeout(commitLive, WHEEL_COMMIT_MS);
        return;
      }
      if (!stage.contains(event.target as Node) || zoom <= BOOK_PAN_ZOOM) return;
      event.preventDefault();
      panTo({ x: x.get() - event.deltaX, y: y.get() - event.deltaY });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", onWheel);
    };
  }, [stage, fit, zoom, scale, x, y, liveScale, commitLive, panTo]);

  // Ikki barmoq (pinch): harakat paytida transform, qo'yilganda holatga.
  useEffect(() => {
    if (!stage) return;
    let start: { distance: number; scale: number; pan: Point; focal: Point } | null = null;
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const point = midpoint(event.touches);
      live.current = true;
      start = {
        distance: distance(event.touches),
        scale: scale.get(),
        pan: { x: x.get(), y: y.get() },
        focal: toFocal(point) ?? { x: 0, y: 0 },
      };
    };
    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      const ratio = start.distance > 0 ? distance(event.touches) / start.distance : 1;
      liveScale(start.scale * ratio, midpoint(event.touches), start);
    };
    const onEnd = (event: TouchEvent) => {
      if (!start || event.touches.length >= 2) return;
      start = null;
      commitLive();
    };
    stage.addEventListener("touchstart", onStart, { passive: true });
    stage.addEventListener("touchmove", onMove, { passive: false });
    stage.addEventListener("touchend", onEnd);
    stage.addEventListener("touchcancel", onEnd);
    return () => {
      stage.removeEventListener("touchstart", onStart);
      stage.removeEventListener("touchmove", onMove);
      stage.removeEventListener("touchend", onEnd);
      stage.removeEventListener("touchcancel", onEnd);
    };
  }, [stage, scale, x, y, toFocal, liveScale, commitLive]);

  // Zoom tinchigach betlar `devicePixelRatio × masshtab` da qayta chiziladi (0.25 qadam bilan —
  // har mayda o'zgarishda emas).
  const [renderScale, setRenderScale] = useState(1);
  useEffect(() => {
    const next = Math.max(1, Math.ceil(target * 4) / 4);
    const timer = window.setTimeout(() => setRenderScale(next), RERENDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [target]);

  return {
    scale,
    x,
    y,
    stageSize,
    renderScale,
    /** Kattalashgan: sudrash — pan (varaq ag'darilmaydi). */
    panMode: zoom > BOOK_PAN_ZOOM,
    /** Pinch yoki Ctrl+g'ildirak davom etmoqda. */
    isLive: () => live.current,
    zoomTo,
    toggleAt,
    panTo,
  };
}
