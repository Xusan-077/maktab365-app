"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import {
  annotationBounds,
  MAX_PER_PAGE,
  MAX_STROKE_POINTS,
  MAX_TEXT_LENGTH,
  moveAnnotation,
  newAnnotationId,
  normalizePoint,
  rectFromDrag,
  resolveColor,
  roundPoint,
  simplifyStroke,
  smoothInput,
  topAnnotationAt,
  hitAnnotation,
  type Annotation,
  type AnnotationTool,
  type NormRect,
  type StrokePoint,
} from "@/lib/books/annotations";
import {
  drawHighlightRects,
  drawStroke,
  fitCanvas,
  renderHighlights,
  renderStrokes,
} from "@/lib/books/annotation-render";
import type { BookTheme } from "@/lib/books/reader";
import { cn } from "@/lib/utils/cn";

export interface DrawSettings {
  penColor: string;
  penWidth: number;
  highlightColor: string;
  textColor: string;
  textSize: number;
}

export interface AnnotationCanvasProps {
  /** Bet qutisining CSS o'lchami (zoom hisobga olingan). */
  size: { width: number; height: number };
  theme: BookTheme;
  tool: AnnotationTool;
  items: readonly Annotation[];
  settings: DrawSettings;
  selectedId: string | null;
  zoom: number;
  onSelect: (id: string | null) => void;
  onCommit: (items: readonly Annotation[]) => void;
  onZoomChange: (zoom: number) => void;
  /** Ikki barmoq / stylus bor paytida bitta barmoq bilan surish. */
  onPan: (dx: number, dy: number) => void;
  /** Bet to'lib ketdi (`MAX_PER_PAGE`). */
  onLimit: () => void;
  /** Matematika: yangi yechim maydoni chizildi yoki mavjudi bosildi. */
  onSolution?: (target: SolutionTarget) => void;
}

export type SolutionTarget = { kind: "new"; rect: NormRect } | { kind: "edit"; id: string };

type Gesture =
  | { kind: "pen"; id: number; points: StrokePoint[] }
  | { kind: "highlight"; id: number; from: [number, number]; to: [number, number] }
  | { kind: "solution"; id: number; from: [number, number]; to: [number, number] }
  | { kind: "erase"; id: number; hit: Set<string> }
  | { kind: "text"; id: number }
  | {
      kind: "move";
      id: number;
      target: Annotation;
      from: [number, number];
      moved: boolean;
    };

interface Editing {
  /** Mavjud matnni tahrirlash bo'lsa — uning id'si. */
  annotationId: string | null;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

const ERASE_RADIUS = 0.012;
const HIT_RADIUS = 0.012;
const DRAG_THRESHOLD_PX = 3;

const CURSORS: Record<AnnotationTool, string> = {
  none: "auto",
  select: "default",
  pen: "crosshair",
  highlight: "crosshair",
  text: "text",
  solution: "crosshair",
  eraser: "cell",
};

/**
 * Bet ustidagi chizish qatlami: ikkita canvas (highlight — CSS `multiply`, chiziqlar), jonli chiziq
 * canvas'i va matn qatlami (DOM). Koordinatalar 0..1, shuning uchun zoom/o'lcham o'zgarsa ham chizma
 * joyida turadi. Pointer Events: bosim, stylus bo'lsa barmoq faqat suradi, ikki barmoq — zoom + surish.
 */
export function AnnotationCanvas({
  size,
  theme,
  tool,
  items,
  settings,
  selectedId,
  zoom,
  onSelect,
  onCommit,
  onZoomChange,
  onPan,
  onLimit,
  onSolution,
}: AnnotationCanvasProps) {
  const t = useTranslations("books.workspace");
  const root = useRef<HTMLDivElement>(null);
  const highlightCanvas = useRef<HTMLCanvasElement>(null);
  const strokeCanvas = useRef<HTMLCanvasElement>(null);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const stylusSeen = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const panning = useRef<number | null>(null);
  const cancelEdit = useRef(false);

  const [erasing, setErasing] = useState<ReadonlySet<string>>(() => new Set());
  const [preview, setPreview] = useState<Annotation | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const aspect = size.height / Math.max(size.width, 1);
  const active = tool !== "none";

  // Ko'rsatiladigan ro'yxat: siljitilayotgan nusxa almashtiriladi, o'chirilayotganlar yashiriladi.
  const shown = items.map((item) => (preview && preview.id === item.id ? preview : item));
  const hidden = new Set(erasing);
  if (editing?.annotationId) hidden.add(editing.annotationId);

  const paintLive = useCallback(() => {
    const canvas = liveCanvas.current;
    if (!canvas) return;
    const ctx = fitCanvas(canvas, size, window.devicePixelRatio || 1);
    if (!ctx) return;
    ctx.clearRect(0, 0, size.width, size.height);
    const current = gesture.current;
    if (current?.kind === "pen") {
      drawStroke(
        ctx,
        { tool: "pen", color: settings.penColor, width: settings.penWidth, points: current.points },
        size,
        theme,
      );
    } else if (current?.kind === "highlight") {
      const rect = rectFromDrag(current.from, current.to, 0);
      if (rect) drawHighlightRects(ctx, settings.highlightColor, [rect], size, theme);
    } else if (current?.kind === "solution") {
      const rect = rectFromDrag(current.from, current.to, 0);
      if (rect) {
        ctx.save();
        ctx.strokeStyle = resolveColor("#3b82f6", theme);
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          rect.x * size.width,
          rect.y * size.height,
          rect.w * size.width,
          rect.h * size.height,
        );
        ctx.restore();
      }
    }
  }, [size, settings.penColor, settings.penWidth, settings.highlightColor, theme]);

  const requestLive = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      paintLive();
    });
  }, [paintLive]);

  // Statik qatlamlar: ro'yxat/o'lcham/fon o'zgarganda qayta chiziladi (rAF ichida emas — React commit'idan keyin).
  useLayoutEffect(() => {
    const ratio = window.devicePixelRatio || 1;
    const high = highlightCanvas.current;
    const ink = strokeCanvas.current;
    if (!high || !ink) return;
    const highCtx = fitCanvas(high, size, ratio);
    const inkCtx = fitCanvas(ink, size, ratio);
    const list = items.map((item) => (preview && preview.id === item.id ? preview : item));
    const skip = new Set(erasing);
    if (editing?.annotationId) skip.add(editing.annotationId);
    if (highCtx) renderHighlights(highCtx, list, size, theme, skip);
    if (inkCtx) renderStrokes(inkCtx, list, size, theme, skip);
    paintLive();
  }, [items, size, theme, preview, erasing, editing, paintLive]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const point = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = root.current?.getBoundingClientRect();
    return rect ? normalizePoint(event.clientX, event.clientY, rect) : [0, 0];
  };

  const addItem = (item: Annotation) => {
    if (items.length >= MAX_PER_PAGE) {
      onLimit();
      return;
    }
    onCommit([...items, item]);
  };

  const capture = (element: HTMLElement, pointerId: number) => {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Ko'rsatkich allaqachon tugagan (masalan sintetik hodisa): chizish baribir davom etadi.
    }
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current || current.id !== event.pointerId) return;
    const [x, y] = point(event);

    switch (current.kind) {
      case "pen": {
        // Silliqlash chiziq uchini ortda qoldiradi: oxirgi haqiqiy nuqta qo'shiladi.
        const last = current.points[current.points.length - 1];
        const tail: StrokePoint = [x, y, last[2]];
        const raw =
          current.points.length > 1 || Math.hypot(x - last[0], y - last[1]) > 0
            ? [...current.points, tail]
            : current.points;
        const points = simplifyStroke(raw, aspect, MAX_STROKE_POINTS).map(roundPoint);
        if (points.length > 0) {
          addItem({
            id: newAnnotationId(),
            type: "drawing",
            data: { tool: "pen", color: settings.penColor, width: settings.penWidth, points },
          });
        }
        break;
      }
      case "highlight": {
        const rect = rectFromDrag(current.from, [x, y]);
        if (rect) {
          addItem({
            id: newAnnotationId(),
            type: "highlight",
            data: { color: settings.highlightColor, rects: [rect] },
          });
        }
        break;
      }
      case "solution": {
        const rect = rectFromDrag(current.from, [x, y]);
        if (rect) {
          onSolution?.({ kind: "new", rect });
        } else {
          const existing = topAnnotationAt(
            items.filter((item) => item.type === "solution"),
            x,
            y,
            aspect,
            HIT_RADIUS,
          );
          if (existing) onSolution?.({ kind: "edit", id: existing.id });
        }
        break;
      }
      case "erase": {
        setErasing(new Set());
        if (current.hit.size > 0) onCommit(items.filter((item) => !current.hit.has(item.id)));
        break;
      }
      case "text": {
        const existing = topAnnotationAt(
          items.filter((item) => item.type === "text"),
          x,
          y,
          aspect,
          HIT_RADIUS,
        );
        if (existing && existing.type === "text") {
          setEditing({ annotationId: existing.id, ...existing.data });
        } else {
          setEditing({
            annotationId: null,
            x: Math.min(x, 0.92),
            y: Math.min(y, 0.96),
            text: "",
            color: settings.textColor,
            size: settings.textSize,
          });
        }
        break;
      }
      case "move": {
        const moved = preview;
        setPreview(null);
        if (current.moved && moved) {
          onCommit(items.map((item) => (item.id === moved.id ? moved : item)));
        }
        break;
      }
    }
    requestLive();
  };

  const cancelGesture = () => {
    gesture.current = null;
    setErasing(new Set());
    setPreview(null);
    requestLive();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || editing) return;
    if (event.pointerType === "pen") stylusSeen.current = true;

    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      capture(event.currentTarget, event.pointerId);
      if (touches.current.size >= 2) {
        // Ikkinchi barmoq: chizish bekor, zoom + surish boshlanadi.
        cancelGesture();
        const [a, b] = [...touches.current.values()];
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom };
        panning.current = null;
        return;
      }
      if (stylusSeen.current) {
        // Qo'l kafti rad etiladi: stylus ishlatilgan bo'lsa barmoq faqat suradi.
        panning.current = event.pointerId;
        return;
      }
    } else if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    capture(event.currentTarget, event.pointerId);
    const [x, y] = point(event);
    if (tool === "pen") {
      const pressure = event.pointerType === "mouse" ? 0.5 : event.pressure || 0.5;
      gesture.current = { kind: "pen", id: event.pointerId, points: [[x, y, pressure]] };
    } else if (tool === "highlight") {
      gesture.current = { kind: "highlight", id: event.pointerId, from: [x, y], to: [x, y] };
    } else if (tool === "solution") {
      gesture.current = { kind: "solution", id: event.pointerId, from: [x, y], to: [x, y] };
    } else if (tool === "eraser") {
      const hit = new Set<string>();
      for (const item of items) {
        // Yechim maydoni sirpanib o'chib ketmasin: u faqat «Tanlash» + Delete yoki tahrirlash oynasidan.
        if (item.type !== "solution" && hitAnnotation(item, x, y, aspect, ERASE_RADIUS))
          hit.add(item.id);
      }
      gesture.current = { kind: "erase", id: event.pointerId, hit };
      setErasing(hit);
    } else if (tool === "text") {
      gesture.current = { kind: "text", id: event.pointerId };
    } else if (tool === "select") {
      const target = topAnnotationAt(items, x, y, aspect, HIT_RADIUS);
      onSelect(target?.id ?? null);
      if (target) {
        gesture.current = { kind: "move", id: event.pointerId, target, from: [x, y], moved: false };
      }
    }
    requestLive();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      const previous = touches.current.get(event.pointerId);
      if (!previous) return;
      const next = { x: event.clientX, y: event.clientY };
      touches.current.set(event.pointerId, next);
      if (pinch.current && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        onZoomChange(pinch.current.zoom * (distance / pinch.current.distance));
        // Markaz siljishi (har ikki barmoqning o'rtacha siljishi) — surish.
        onPan(-(next.x - previous.x) / 2, -(next.y - previous.y) / 2);
        return;
      }
      if (panning.current === event.pointerId) {
        onPan(previous.x - next.x, previous.y - next.y);
        return;
      }
    }

    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const events =
      event.pointerType === "pen" && typeof event.nativeEvent.getCoalescedEvents === "function"
        ? event.nativeEvent.getCoalescedEvents()
        : [];
    const samples = events.length > 0 ? events : [event.nativeEvent];

    for (const sample of samples) {
      const [x, y] = point(sample);
      if (current.kind === "pen") {
        const pressure = sample.pointerType === "mouse" ? 0.5 : sample.pressure || 0.5;
        const last = current.points[current.points.length - 1];
        const next = smoothInput(last, [x, y, pressure]);
        const dx = (next[0] - last[0]) * size.width;
        const dy = (next[1] - last[1]) * size.height;
        if (Math.hypot(dx, dy) >= 0.6) current.points.push(next);
      } else if (current.kind === "highlight" || current.kind === "solution") {
        current.to = [x, y];
      } else if (current.kind === "erase") {
        let added = false;
        for (const item of items) {
          if (
            item.type !== "solution" &&
            !current.hit.has(item.id) &&
            hitAnnotation(item, x, y, aspect, ERASE_RADIUS)
          ) {
            current.hit.add(item.id);
            added = true;
          }
        }
        if (added) setErasing(new Set(current.hit));
      } else if (current.kind === "move") {
        const dx = (x - current.from[0]) * size.width;
        const dy = (y - current.from[1]) * size.height;
        if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) continue;
        current.moved = true;
        setPreview(
          moveAnnotation(current.target, x - current.from[0], y - current.from[1], aspect),
        );
      }
    }
    requestLive();
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      touches.current.delete(event.pointerId);
      if (touches.current.size < 2) pinch.current = null;
      if (panning.current === event.pointerId) {
        panning.current = null;
        return;
      }
    }
    if (event.type === "pointercancel") cancelGesture();
    else finish(event);
  };

  const commitText = (value: string) => {
    const current = editing;
    setEditing(null);
    if (cancelEdit.current) {
      cancelEdit.current = false;
      return;
    }
    if (!current) return;
    const text = value.slice(0, MAX_TEXT_LENGTH).trimEnd();
    if (current.annotationId) {
      if (text.trim() === "") {
        onCommit(items.filter((item) => item.id !== current.annotationId));
        return;
      }
      onCommit(
        items.map((item) =>
          item.id === current.annotationId && item.type === "text"
            ? { ...item, data: { ...item.data, text } }
            : item,
        ),
      );
      return;
    }
    if (text.trim() === "") return;
    addItem({
      id: newAnnotationId(),
      type: "text",
      data: { x: current.x, y: current.y, text, color: current.color, size: current.size },
    });
  };

  const onDoubleClick = (event: ReactPointerEvent<HTMLDivElement> | React.MouseEvent) => {
    if (tool !== "select") return;
    const [x, y] = point(event);
    const target = topAnnotationAt(items, x, y, aspect, HIT_RADIUS);
    if (target?.type === "text") setEditing({ annotationId: target.id, ...target.data });
    else if (target?.type === "solution") onSolution?.({ kind: "edit", id: target.id });
  };

  const selected = selectedId ? shown.find((item) => item.id === selectedId) : undefined;
  const bounds = selected ? annotationBounds(selected, aspect) : null;

  return (
    <div
      ref={root}
      data-annotation-canvas
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute inset-0 select-none",
        active ? "touch-none" : "pointer-events-none",
        active && "ring-bk-accent/70 ring-2 ring-inset",
      )}
      style={{ cursor: CURSORS[tool] }}
    >
      <canvas
        ref={highlightCanvas}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 size-full",
          theme === "night" ? "mix-blend-normal" : "mix-blend-multiply",
        )}
      />
      <canvas
        ref={strokeCanvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <canvas
        ref={liveCanvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />

      {shown.map((item) =>
        item.type === "text" && !hidden.has(item.id) ? (
          <div
            key={item.id}
            className="pointer-events-none absolute leading-[1.35] whitespace-pre-wrap"
            style={{
              left: `${item.data.x * 100}%`,
              top: `${item.data.y * 100}%`,
              fontSize: item.data.size * size.width,
              color: resolveColor(item.data.color, theme),
              maxWidth: `${(1 - item.data.x) * 100}%`,
            }}
          >
            {item.data.text}
          </div>
        ) : null,
      )}

      {shown.map((item) =>
        item.type === "solution" ? (
          <div
            key={item.id}
            data-solution-box={item.id}
            className="border-bk-accent/80 pointer-events-none absolute rounded-sm border-2 border-dashed"
            style={{
              left: `${item.data.rect.x * 100}%`,
              top: `${item.data.rect.y * 100}%`,
              width: `${item.data.rect.w * 100}%`,
              height: `${item.data.rect.h * 100}%`,
            }}
          >
            <span className="bg-bk-accent absolute -top-px -left-px max-w-full truncate rounded-br-md px-1.5 py-0.5 text-[0.6875rem] leading-tight font-semibold text-white">
              {item.data.title || "∑"}
            </span>
          </div>
        ) : null,
      )}

      {bounds && (
        <div
          aria-hidden
          className="border-bk-accent pointer-events-none absolute rounded-sm border-2 border-dashed"
          style={{
            left: `calc(${bounds.x * 100}% - 4px)`,
            top: `calc(${bounds.y * 100}% - 4px)`,
            width: `calc(${bounds.w * 100}% + 8px)`,
            height: `calc(${bounds.h * 100}% + 8px)`,
          }}
        />
      )}

      {editing && (
        <textarea
          autoFocus
          aria-label={t("textInput")}
          placeholder={t("textPlaceholder")}
          defaultValue={editing.text}
          maxLength={MAX_TEXT_LENGTH}
          rows={1}
          onBlur={(event) => commitText(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              cancelEdit.current = true;
              setEditing(null);
            } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.currentTarget.blur();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="border-bk-accent bg-bk-paper/70 absolute min-w-24 resize-none rounded-sm border border-dashed leading-[1.35] outline-none"
          style={{
            left: `${editing.x * 100}%`,
            top: `${editing.y * 100}%`,
            fontSize: editing.size * size.width,
            color: resolveColor(editing.color, theme),
            maxWidth: `${(1 - editing.x) * 100}%`,
            fieldSizing: "content",
          }}
        />
      )}
    </div>
  );
}
