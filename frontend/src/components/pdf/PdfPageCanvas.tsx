"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { matchRects, type NormalizedRect, type PositionedItem } from "@/lib/pdf/find";
import {
  loadPdfjs,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from "@/lib/pdf/pdfjs";

const JUSTIFY = { start: "justify-start", center: "justify-center", end: "justify-end" } as const;

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
  /** Tanlanadigan matn qatlami (pdf.js `TextLayer`): matnli (skanerlanmagan) kitoblarda. */
  textLayer?: boolean;
  /** `contain` da gorizontal joylashuv: yoymada chap bet umurtqaga (o'ngga), o'ng bet chapga. */
  align?: "start" | "center" | "end";
  /** Joriy (URL'dagi) bet: bir nechta bet chizilganda testlar va e2e uchun `data-current`. */
  current?: boolean;
}

/** Canvas o'lchami bilan bir xil masshtab (CSS px): sahifa eni/bo'yi konteynerga moslanadi. */
function fitScale(
  natural: { width: number; height: number },
  width: number,
  height: number,
  contain: boolean,
) {
  return contain ? Math.min(width / natural.width, height / natural.height) : width / natural.width;
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
  textLayer = false,
  align = "center",
  current,
}: PdfPageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
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
    const target = canvasRef.current;
    void (async () => {
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const scale = fitScale(page.getViewport({ scale: 1 }), width, height, contain);
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
        if (!cancelled && !isCancelled(error)) {
          console.error(`[pdf] ${pageNumber}-betni chizib bo'lmadi`, error);
          notifyError(error);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
      // Canvas xotirasi darhol bo'shaydi (virtualizatsiyada bet ro'yxatdan chiqqanda).
      if (target && !target.isConnected) {
        target.width = 0;
        target.height = 0;
      }
    };
  }, [doc, pageNumber, width, height, contain]);

  // Matn qatlami: shaffof span'lar canvas ustida (belgilash/nusxa olish), canvas'dan mustaqil.
  useEffect(() => {
    const container = textRef.current;
    if (!textLayer || !container || !width || (contain && !height)) return;
    let cancelled = false;
    let layer: { cancel(): void } | undefined;
    void (async () => {
      try {
        const [pdfjs, page] = await Promise.all([loadPdfjs(), doc.getPage(pageNumber)]);
        if (cancelled) return;
        const scale = fitScale(page.getViewport({ scale: 1 }), width, height, contain);
        const viewport = page.getViewport({ scale });
        container.replaceChildren();
        container.style.setProperty("--scale-factor", String(scale));
        container.style.setProperty("--total-scale-factor", String(scale));
        const textLayerTask = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport,
        });
        layer = textLayerTask;
        await textLayerTask.render();
      } catch (error) {
        // Matn qatlami ixtiyoriy: xatosi sahifa ko'rinishiga ta'sir qilmaydi.
        if (!cancelled) console.warn(`[pdf] ${pageNumber}-bet matn qatlami chizilmadi`, error);
      }
    })();
    return () => {
      cancelled = true;
      layer?.cancel();
      container.replaceChildren();
    };
  }, [doc, pageNumber, width, height, contain, textLayer]);

  // Qidiruv belgilari: matn bo'laklari joylashuvidan (render'dan mustaqil, bekor qilinadigan).
  const markKey = `${pageNumber}|${highlight ?? ""}|${width}|${height}|${contain}`;
  useEffect(() => {
    if (!highlight || !width || (contain && !height)) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        const scale = fitScale(page.getViewport({ scale: 1 }), width, height, contain);
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
      className={cn(contain ? "flex size-full items-center" : "w-full", contain && JUSTIFY[align])}
    >
      <div
        className={cn("relative w-fit max-w-full", (!contain || align === "center") && "mx-auto")}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          data-testid="pdf-canvas"
          data-page={pageNumber}
          data-current={current || undefined}
          className="bg-surface mx-auto block max-w-full rounded-sm shadow-md"
        />
        {textLayer && <div ref={textRef} className="textLayer" data-testid="pdf-text-layer" />}
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
