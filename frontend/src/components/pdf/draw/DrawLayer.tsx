"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  hitAnnotation,
  MAX_PER_PAGE,
  MAX_STROKE_POINTS,
  newAnnotationId,
  normalizePoint,
  roundPoint,
  simplifyStroke,
  smoothInput,
  type Annotation,
  type StrokePoint,
  type StrokeTool,
} from "@/lib/books/annotations";
import { drawStroke, fitCanvas, renderAll } from "@/lib/books/annotation-render";
import type { BookTheme } from "@/lib/books/reader";
import { cn } from "@/lib/utils/cn";

/** Chizish rejimidagi asbob; `none` — rejim o'chiq (qatlam faqat ko'rsatadi, hodisa olmaydi). */
export type DrawTool = "none" | StrokeTool | "eraser";

export interface DrawLayerProps {
  items: readonly Annotation[];
  tool: DrawTool;
  color: string;
  /** Bet eniga nisbatan (0..1). */
  width: number;
  theme: BookTheme;
  /** Canvas zichligi uchun qo'shimcha masshtab (kitob rejimidagi CSS zoom: chiziq xira bo'lmasin). */
  pixelScale?: number;
  onCommit: (items: readonly Annotation[]) => void;
  /** Bet to'lib ketdi (`MAX_PER_PAGE`). */
  onLimit?: () => void;
  /**
   * Stylus ishlatilgandan keyin bitta barmoq — surish. Berilmasa barmoq hodisasi ota elementga
   * o'tadi (kitob rejimi o'zi suradi/varaqlaydi).
   */
  onPan?: (dx: number, dy: number) => void;
}

type Gesture =
  | { kind: "stroke"; id: number; points: StrokePoint[] }
  | { kind: "erase"; id: number; hit: Set<string> };

const ERASE_RADIUS = 0.014;
/** Stylus ko'tarilgandan keyin shuncha ms barmoq (kaft) tegishi e'tiborsiz. */
const PALM_GUARD_MS = 600;
/** Bitta canvas tomoni shundan oshmasin (telefon xotirasi). */
const MAX_CANVAS_SIDE = 4096;

const CURSORS: Record<DrawTool, string> = {
  none: "auto",
  pen: "crosshair",
  marker: "crosshair",
  eraser: "cell",
};

/**
 * Bet ustidagi shaffof chizish qatlami. Chiziqlar vektor (`{ tool, color, width, points:
 * [[x, y, bosim]] }`), koordinatalar bet o'lchamiga nisbatan 0..1 — zoom va ekran o'lchami
 * o'zgarsa ham chizma joyida qoladi.
 *
 * Pointer Events: bitta barmoq / stylus / sichqoncha chizadi; ikkinchi barmoq tegsa chizish bekor
 * bo'ladi va pinch/surish ota element (kitob yoki uzluksiz rejim zoom'i) ga o'tadi — touch hodisalari
 * yuqoriga ko'tariladi, pointer hodisalari esa chizish paytida to'xtatiladi (varaq ag'darilmaydi).
 * Stylus (`pen`) ko'rilgach barmoq chizmaydi (kaft rad etiladi). Nuqtalar rAF bilan yig'iladi.
 */
export function DrawLayer({
  items,
  tool,
  color,
  width,
  theme,
  pixelScale = 1,
  onCommit,
  onLimit,
  onPan,
}: DrawLayerProps) {
  const root = useRef<HTMLDivElement>(null);
  const staticCanvas = useRef<HTMLCanvasElement>(null);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const stylus = useRef({ seen: false, down: false, upAt: 0 });
  const panning = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [erasing, setErasing] = useState<ReadonlySet<string>>(() => new Set());
  const active = tool !== "none";
  const aspect = size.height / Math.max(size.width, 1);

  // CSS o'lcham (transform'siz): canvas piksellari shunga moslanadi.
  useEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ratio = useCallback(() => {
    const base = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const side = Math.max(size.width, size.height, 1);
    return Math.min(base * Math.max(1, pixelScale), MAX_CANVAS_SIDE / side);
  }, [size.width, size.height, pixelScale]);

  const paintLive = useCallback(() => {
    const canvas = liveCanvas.current;
    if (!canvas || !size.width) return;
    const ctx = fitCanvas(canvas, size, ratio());
    if (!ctx) return;
    ctx.clearRect(0, 0, size.width, size.height);
    const current = gesture.current;
    if (current?.kind === "stroke" && (tool === "pen" || tool === "marker")) {
      drawStroke(ctx, { tool, color, width, points: current.points }, size, theme);
    }
  }, [size, ratio, tool, color, width, theme]);

  const requestLive = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      paintLive();
    });
  }, [paintLive]);

  useLayoutEffect(() => {
    const canvas = staticCanvas.current;
    if (!canvas || !size.width) return;
    const ctx = fitCanvas(canvas, size, ratio());
    if (!ctx) return;
    ctx.clearRect(0, 0, size.width, size.height);
    renderAll(
      ctx,
      erasing.size > 0 ? items.filter((item) => !erasing.has(item.id)) : items,
      size,
      theme,
    );
  }, [items, size, ratio, theme, erasing]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // iOS Safari: bitta barmoq bilan chizayotganda sahifa scroll bo'lmasin (`touch-action` ga
  // qo'shimcha). Ikki barmoq — preventDefault yo'q: pinch'ni ota element o'zi boshqaradi.
  useEffect(() => {
    const element = root.current;
    if (!element || !active) return;
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1 && gesture.current) event.preventDefault();
    };
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => element.removeEventListener("touchmove", onTouchMove);
  }, [active]);

  const point = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = root.current?.getBoundingClientRect();
    return rect ? normalizePoint(event.clientX, event.clientY, rect) : [0, 0];
  };

  const cancelGesture = () => {
    gesture.current = null;
    setErasing(new Set());
    requestLive();
  };

  const capture = (element: HTMLElement, pointerId: number) => {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Ko'rsatkich allaqachon tugagan: chizish capture'siz davom etadi.
    }
  };

  const palmGuard = () =>
    stylus.current.down || performance.now() - stylus.current.upAt < PALM_GUARD_MS;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size >= 2) {
        // Ikkinchi barmoq: chizish bekor. Pinch — touch hodisalarida (ota element zoom'i), pointer
        // hodisasi esa to'xtatiladi: varaq ag'darish/pan boshlanib ketmasin.
        event.stopPropagation();
        cancelGesture();
        panning.current = null;
        return;
      }
      if (stylus.current.seen) {
        // Kaft: stylus bilan yozayotganda (yoki hozirgina) — butunlay e'tiborsiz.
        if (palmGuard()) {
          event.stopPropagation();
          return;
        }
        // Stylus ishlatilgan: barmoq chizmaydi, faqat suradi.
        if (onPan) {
          event.stopPropagation();
          capture(event.currentTarget, event.pointerId);
          panning.current = event.pointerId;
        }
        return;
      }
    }
    if (event.pointerType === "pen") {
      stylus.current.seen = true;
      stylus.current.down = true;
    }

    // Chizish: varaq ag'darish / swipe / pan (ota element) ishga tushmasin.
    event.stopPropagation();
    event.preventDefault();
    capture(event.currentTarget, event.pointerId);
    const [x, y] = point(event);
    if (tool === "eraser") {
      const hit = new Set<string>();
      for (const item of items)
        if (hitAnnotation(item, x, y, aspect, ERASE_RADIUS)) hit.add(item.id);
      gesture.current = { kind: "erase", id: event.pointerId, hit };
      setErasing(hit);
    } else {
      const pressure = event.pointerType === "pen" ? event.pressure || 0.5 : 0.5;
      gesture.current = { kind: "stroke", id: event.pointerId, points: [[x, y, pressure]] };
    }
    requestLive();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      const previous = touches.current.get(event.pointerId);
      if (previous) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (panning.current === event.pointerId && previous) {
        event.stopPropagation();
        onPan?.(previous.x - event.clientX, previous.y - event.clientY);
        return;
      }
      if (touches.current.size >= 2 && previous) {
        // Ikki barmoq: o'rtacha siljish — surish (uzluksiz rejim; kitobda pinch o'zi suradi).
        event.stopPropagation();
        onPan?.((previous.x - event.clientX) / 2, (previous.y - event.clientY) / 2);
        return;
      }
    }
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    event.stopPropagation();
    // Coalesced: 60 Hz dan tez kelgan oraliq nuqtalar ham (chiziq burchakli chiqmasin).
    const coalesced =
      typeof event.nativeEvent.getCoalescedEvents === "function"
        ? event.nativeEvent.getCoalescedEvents()
        : [];
    const samples = coalesced.length > 0 ? coalesced : [event.nativeEvent];
    for (const sample of samples) {
      const [x, y] = point(sample);
      if (current.kind === "stroke") {
        const pressure = sample.pointerType === "pen" ? sample.pressure || 0.5 : 0.5;
        const last = current.points[current.points.length - 1];
        const next = smoothInput(last, [x, y, pressure]);
        const dx = (next[0] - last[0]) * size.width;
        const dy = (next[1] - last[1]) * size.height;
        if (Math.hypot(dx, dy) >= 0.6) current.points.push(next);
      } else {
        let added = false;
        for (const item of items) {
          if (!current.hit.has(item.id) && hitAnnotation(item, x, y, aspect, ERASE_RADIUS)) {
            current.hit.add(item.id);
            added = true;
          }
        }
        if (added) setErasing(new Set(current.hit));
      }
    }
    requestLive();
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.id !== event.pointerId) return;
    event.stopPropagation();
    if (current.kind === "erase") {
      setErasing(new Set());
      if (current.hit.size > 0) onCommit(items.filter((item) => !current.hit.has(item.id)));
    } else if (tool === "pen" || tool === "marker") {
      const [x, y] = point(event);
      const last = current.points[current.points.length - 1];
      // Silliqlash chiziq uchini ortda qoldiradi: oxirgi haqiqiy nuqta qo'shiladi.
      const raw =
        Math.hypot(x - last[0], y - last[1]) > 0
          ? [...current.points, [x, y, last[2]] as const]
          : current.points;
      const points = simplifyStroke(raw, aspect, MAX_STROKE_POINTS).map(roundPoint);
      if (points.length > 0) {
        if (items.length >= MAX_PER_PAGE) onLimit?.();
        else {
          onCommit([
            ...items,
            { id: newAnnotationId(), type: "drawing", data: { tool, color, width, points } },
          ]);
        }
      }
    }
    requestLive();
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "pen") {
      stylus.current.down = false;
      stylus.current.upAt = performance.now();
    }
    if (event.pointerType === "touch") {
      const wasMulti = touches.current.size >= 2;
      touches.current.delete(event.pointerId);
      if (wasMulti) event.stopPropagation();
      if (panning.current === event.pointerId) {
        panning.current = null;
        event.stopPropagation();
        return;
      }
    }
    if (event.type === "pointercancel") {
      if (gesture.current?.id === event.pointerId) cancelGesture();
      return;
    }
    finish(event);
  };

  return (
    <div
      ref={root}
      data-draw-layer
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={cn(
        "absolute inset-0 z-[2] select-none",
        active ? "touch-none" : "pointer-events-none",
      )}
      style={{ cursor: CURSORS[tool] }}
    >
      <canvas
        ref={staticCanvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <canvas
        ref={liveCanvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
    </div>
  );
}
