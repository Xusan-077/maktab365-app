"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { matchRects, type NormalizedRect, type PositionedItem } from "@/lib/pdf/find";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "@/lib/pdf/pdfjs";

/** Fizik piksellar zichligi chegarasi: 3x ekranlarda xotira/vaqtni tejaydi. */
const MAX_PIXEL_RATIO = 2;

const isCancelled = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: string }).name === "RenderingCancelledException";

export interface PdfPageCanvasProps {
  doc: PDFDocumentProxy;
  /** 1 dan boshlanadi. */
  pageNumber: number;
  label: string;
  onRendered?: () => void;
  onError: (error: unknown) => void;
  /**
   * `width` (default) — konteyner eniga moslanadi (kitob). `contain` — konteynerga to'liq sig'adi
   * (en va bo'yi bo'yicha, o'rtada): prezentatsiya uchun; konteynerning balandligi aniq bo'lishi kerak.
   */
  fit?: "width" | "contain";
  /** Qidiruv so'zi: sahifadagi moslashuvlar sariq bilan belgilanadi (matn qatlami bor PDF). */
  highlight?: string;
  /** Canvas ustidagi qatlam (belgilar): canvas bilan bir xil o'lchamli quti ichida. */
  overlay?: ReactNode;
}

/** Faqat berilgan bitta sahifani konteynerga moslab chizadi; sahifa o'zgarsa oldingisi bekor qilinadi. */
export function PdfPageCanvas({
  doc,
  pageNumber,
  label,
  onRendered,
  onError,
  fit = "width",
  highlight,
  overlay,
}: PdfPageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const contain = fit === "contain";
  const [marks, setMarks] = useState<{ key: string; rects: NormalizedRect[] }>({
    key: "",
    rects: [],
  });
  const notifyRendered = useEffectEvent(() => onRendered?.());
  const notifyError = useEffectEvent((error: unknown) => onError(error));

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width || (contain && !height)) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let page: PDFPageProxy | undefined;
    void (async () => {
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const natural = page.getViewport({ scale: 1 });
        const scale = contain
          ? Math.min(width / natural.width, height / natural.height)
          : width / natural.width;
        const viewport = page.getViewport({ scale: scale * ratio });
        // Sahifa ekrandan tashqari canvas'da chiziladi: tayyor bo'lgach bir zumda almashadi
        // (joriy sahifa bo'sh oq kadrsiz turadi, o'lcham sakramaydi).
        const buffer = document.createElement("canvas");
        buffer.width = Math.floor(viewport.width);
        buffer.height = Math.floor(viewport.height);
        const context = buffer.getContext("2d");
        if (!context) throw new Error("Canvas is not available");
        task = page.render({ canvas: buffer, canvasContext: context, viewport });
        await task.promise;
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = buffer.width;
        canvas.height = buffer.height;
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
        canvas.getContext("2d")?.drawImage(buffer, 0, 0);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          canvas.animate([{ opacity: 0.55 }, { opacity: 1 }], {
            duration: 160,
            easing: "ease-out",
          });
        }
        if (!cancelled) notifyRendered();
      } catch (error) {
        if (!cancelled && !isCancelled(error)) notifyError(error);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [doc, pageNumber, width, height, contain]);

  // Qidiruv belgilari: matn bo'laklari joylashuvidan (render'dan mustaqil, bekor qilinadigan).
  const markKey = `${pageNumber}|${highlight ?? ""}|${width}|${height}|${contain}`;
  useEffect(() => {
    if (!highlight || !width || (contain && !height)) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        const natural = page.getViewport({ scale: 1 });
        const scale = contain
          ? Math.min(width / natural.width, height / natural.height)
          : width / natural.width;
        const viewport = page.getViewport({ scale });
        const content = await page.getTextContent();
        const items = content.items.filter(
          (item): item is typeof item & PositionedItem => "str" in item && "transform" in item,
        );
        const rects = matchRects(
          items,
          highlight,
          ([x1, y1, x2, y2]) => {
            // PDF → viewport: [a b c d e f] matritsasi (aylanish va y o'qining teskarisi hisobga olingan).
            const [a, b, c, d, e, f] = viewport.transform;
            return [
              a * x1 + c * y1 + e,
              b * x1 + d * y1 + f,
              a * x2 + c * y2 + e,
              b * x2 + d * y2 + f,
            ];
          },
          viewport.width,
          viewport.height,
        );
        if (!cancelled) setMarks({ key: markKey, rects });
      } catch {
        if (!cancelled) setMarks({ key: markKey, rects: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, width, height, contain, highlight, markKey]);
  const rects = highlight && marks.key === markKey ? marks.rects : [];

  return (
    <div
      ref={wrapRef}
      className={contain ? "flex size-full items-center justify-center" : "w-full"}
    >
      <div className="relative mx-auto w-fit max-w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          data-testid="pdf-canvas"
          data-page={pageNumber}
          className="bg-surface mx-auto block max-w-full rounded-sm shadow-md"
        />
        {overlay}
        {rects.length > 0 && (
          <div aria-hidden data-testid="pdf-marks" className="pointer-events-none absolute inset-0">
            {rects.map((rect, index) => (
              <span
                key={index}
                className="pdf-mark absolute rounded-[2px]"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
