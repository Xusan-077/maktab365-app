"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { cn } from "@/lib/utils/cn";

/** Thumbnail masshtabi (PDF nuqtasiga nisbatan): A4 ≈ 120×170 px. */
const THUMB_SCALE = 0.2;
/** Bir vaqtda chiziladigan thumbnail'lar soni (asosiy betlar renderini sekinlatmasin). */
const CONCURRENCY = 2;

type ThumbState = { status: "ready"; url: string } | { status: "failed" };

/**
 * Thumbnail'lar navbati (hujjat bo'yicha): ekrandan tashqari canvas'da chiziladi, rasm (blob URL)
 * sifatida saqlanadi va canvas darhol bo'shatiladi — DOM'da canvas qolmaydi.
 */
function useThumbnails(doc: PDFDocumentProxy) {
  const [thumbs, setThumbs] = useState<Map<number, ThumbState>>(() => new Map());
  const queue = useRef<number[]>([]);
  const requested = useRef(new Set<number>());
  const running = useRef(0);
  const alive = useRef(true);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    alive.current = true;
    const created = urls.current;
    return () => {
      alive.current = false;
      queue.current = [];
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);

  const renderOne = async (pageNumber: number): Promise<ThumbState> => {
    const canvas = document.createElement("canvas");
    try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: THUMB_SCALE });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.7),
      );
      if (!blob) throw new Error("Thumbnail encode failed");
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      return { status: "ready", url };
    } catch (error) {
      console.warn(`[pdf] ${pageNumber}-bet thumbnail'i chizilmadi`, error);
      return { status: "failed" };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  };

  const pump = () => {
    while (running.current < CONCURRENCY && queue.current.length > 0) {
      const pageNumber = queue.current.shift() as number;
      running.current += 1;
      void renderOne(pageNumber).then((state) => {
        running.current -= 1;
        if (!alive.current) return;
        setThumbs((current) => new Map(current).set(pageNumber, state));
        pump();
      });
    }
  };

  const request = (pageNumber: number) => {
    if (requested.current.has(pageNumber)) return;
    requested.current.add(pageNumber);
    queue.current.push(pageNumber);
    pump();
  };

  return { thumbs, request };
}

export interface ThumbnailStripProps {
  doc: PDFDocumentProxy;
  page: number;
  total: number;
  onGo: (page: number) => void;
  className?: string;
}

/**
 * "Sahifalar" lentasi: har bet kichik rasm, ko'ringanda (IntersectionObserver) navbat bilan
 * chiziladi. Bitta thumbnail xato bersa faqat o'rnida bet raqami qoladi — lenta ishlayveradi.
 */
export function ThumbnailStrip({ doc, page, total, onGo, className }: ThumbnailStripProps) {
  const t = useTranslations("pdfBooks.reader");
  const listRef = useRef<HTMLOListElement>(null);
  const { thumbs, request } = useThumbnails(doc);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNumber = Number((entry.target as HTMLElement).dataset.thumb);
          requestRef.current(pageNumber);
          observer.unobserve(entry.target);
        }
      },
      { root: list, rootMargin: "0px 200px" },
    );
    for (const item of list.querySelectorAll("[data-thumb]")) observer.observe(item);
    return () => observer.disconnect();
  }, [total]);

  // Joriy bet lentada ko'rinib tursin.
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-thumb="${page}"]`);
    item?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [page]);

  return (
    <ol
      ref={listRef}
      aria-label={t("pages")}
      data-testid="pdf-thumbnails"
      className={cn("flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-2", className)}
    >
      {Array.from({ length: total }, (_, index) => {
        const number = index + 1;
        const thumb = thumbs.get(number);
        const active = number === page;
        return (
          <li key={number} data-thumb={number} className="shrink-0">
            <button
              type="button"
              aria-label={t("thumb", { page: number })}
              aria-current={active ? "page" : undefined}
              data-testid="pdf-thumb"
              onClick={() => onGo(number)}
              className={cn(
                "bg-surface flex h-[5.5rem] w-16 flex-col items-center justify-center overflow-hidden rounded-md border-2 text-xs tabular-nums transition-colors",
                active ? "border-brand" : "border-border hover:border-brand-soft",
              )}
            >
              {thumb?.status === "ready" ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob URL, optimizatsiya kerak emas
                <img src={thumb.url} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className={cn(thumb?.status === "failed" ? "text-muted" : "text-muted/60")}>
                  {number}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
