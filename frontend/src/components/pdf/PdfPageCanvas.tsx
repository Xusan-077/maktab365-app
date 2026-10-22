"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
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
}

/** Faqat berilgan bitta sahifani konteyner eniga moslab chizadi; sahifa o'zgarsa oldingisi bekor qilinadi. */
export function PdfPageCanvas({ doc, pageNumber, label, onRendered, onError }: PdfPageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const notifyRendered = useEffectEvent(() => onRendered?.());
  const notifyError = useEffectEvent((error: unknown) => onError(error));

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let page: PDFPageProxy | undefined;
    void (async () => {
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const fit = width / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: fit * ratio });
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
  }, [doc, pageNumber, width]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        data-testid="pdf-canvas"
        data-page={pageNumber}
        className="bg-surface mx-auto block max-w-full rounded-sm shadow-md"
      />
    </div>
  );
}
