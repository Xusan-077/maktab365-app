"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { rectFromDrag, type Annotation, type AnnotationRect } from "@/lib/pdf/annotations";
import { cn } from "@/lib/utils/cn";

export interface AnnotationLayerProps {
  annotations: Annotation[];
  /** Belgilash rejimi: sudrash yangi to'rtburchak yaratadi. */
  drawing: boolean;
  /** Sudrash tugadi (yetarlicha katta). */
  onDraw: (rect: AnnotationRect) => void;
  /** Mavjud belgi bosildi (tahrirlash). */
  onSelect: (annotation: Annotation) => void;
}

/**
 * PDF sahifasi ustidagi belgilar qatlami (canvas bilan bir xil o'lchamli quti ichida). Belgilash
 * rejimida sudrash to'rtburchak chizadi; rejim o'chiq bo'lsa belgilar faqat bosiladi (sahifa
 * almashtirish va zoom bilan to'qnashmaydi: qatlam faqat belgilar ustida hodisa oladi).
 */
export function AnnotationLayer({ annotations, drawing, onDraw, onSelect }: AnnotationLayerProps) {
  const t = useTranslations("pdfBooks.annotations");
  const box = useRef<HTMLDivElement>(null);
  // Sudrash holati: boshlanish, joriy nuqta va sahifa qutisi (boshlanishda bir marta o'lchanadi).
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    cx: number;
    cy: number;
    area: DOMRect;
  } | null>(null);

  const preview = drag
    ? rectFromDrag({ x: drag.x, y: drag.y }, { x: drag.cx, y: drag.cy }, drag.area)
    : null;

  const onPointerDown = (event: PointerEvent) => {
    const area = box.current?.getBoundingClientRect();
    if (!drawing || !area) return;
    // Sahifa almashtirish/zoom (ota element) hodisasi ishga tushmasin.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: event.clientX, y: event.clientY, cx: event.clientX, cy: event.clientY, area });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (drag) setDrag({ ...drag, cx: event.clientX, cy: event.clientY });
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!drag) return;
    event.stopPropagation();
    const rect = rectFromDrag(
      { x: drag.x, y: drag.y },
      { x: event.clientX, y: event.clientY },
      drag.area,
    );
    setDrag(null);
    if (rect) onDraw(rect);
  };

  return (
    <div
      ref={box}
      data-testid="annotation-layer"
      data-drawing={drawing || undefined}
      className={cn(
        "absolute inset-0",
        drawing ? "cursor-crosshair touch-none" : "pointer-events-none",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      {annotations.flatMap((annotation) =>
        annotation.rects.map((rect, index) => (
          <button
            key={`${annotation.id}-${index}`}
            type="button"
            data-testid="annotation-mark"
            data-color={annotation.color}
            aria-label={annotation.note ? t("markWithNote", { note: annotation.note }) : t("mark")}
            title={annotation.note || undefined}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelect(annotation)}
            className="pdf-note pointer-events-auto absolute rounded-[2px]"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          >
            {annotation.note && index === 0 && <span aria-hidden className="pdf-note-flag" />}
          </button>
        )),
      )}
      {preview && (
        <span
          aria-hidden
          data-testid="annotation-preview"
          className="pdf-note-draft absolute rounded-[2px]"
          style={{
            left: `${preview.x * 100}%`,
            top: `${preview.y * 100}%`,
            width: `${preview.w * 100}%`,
            height: `${preview.h * 100}%`,
          }}
        />
      )}
    </div>
  );
}
