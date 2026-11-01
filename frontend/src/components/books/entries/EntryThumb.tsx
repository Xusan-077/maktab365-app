"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { renderAll } from "@/lib/books/annotation-render";
import { parsedAnnotations } from "@/lib/books/entries";
import type { PageEntry } from "@/lib/books/api";
import { libraryDocument, renderPageBlob } from "@/lib/books/page-image";

const THUMB_WIDTH = 240;
/** Eskiz PDF'dan chiziladi: retina uchun 2× (CSS eni ~160–240 px). */
const PDF_THUMB_WIDTH = THUMB_WIDTH * 2;
const DEFAULT_ASPECT = 1.4;

interface PdfThumb {
  url: string;
  aspect: number;
}

/**
 * Serverda tayyor eskizi yo'q betlar (PDF o'qish): bet PDF'ning o'zidan brauzerda kichik rasmga
 * chiziladi. `enabled=false` bo'lsa hech narsa qilinmaydi (eski kitoblar tayyor eskizdan foydalanadi).
 */
function usePdfThumb(bookId: string, page: number, enabled: boolean): PdfThumb | null {
  const [thumb, setThumb] = useState<(PdfThumb & { key: string }) | null>(null);
  const key = `${bookId}:${page}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let url: string | null = null;
    void (async () => {
      try {
        const doc = await libraryDocument(bookId);
        const blob = await renderPageBlob(doc, page, PDF_THUMB_WIDTH, "image/webp");
        const bitmap = await createImageBitmap(blob);
        const aspect = bitmap.height / bitmap.width;
        bitmap.close();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setThumb({ key, url, aspect });
      } catch {
        // eskiz ixtiyoriy: yozuv (matn/chizma) baribir ko'rinadi
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [bookId, page, enabled, key]);

  return thumb?.key === key ? thumb : null;
}

/** Bet eskizi + chizma/belgilash/matn qatlami (eksportdagi bilan bir xil chizish kodi). */
export function EntryThumb({ entry, alt }: { entry: PageEntry; alt: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = entry.image;
  const fromPdf = usePdfThumb(entry.book.id, entry.page, !image);
  const aspect =
    image && image.width > 0 ? image.height / image.width : (fromPdf?.aspect ?? DEFAULT_ASPECT);
  const height = Math.round(THUMB_WIDTH * aspect);
  const src = image ? image.thumbnail || image.image : (fromPdf?.url ?? null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    ctx.clearRect(0, 0, element.width, element.height);
    renderAll(
      ctx,
      parsedAnnotations(entry),
      { width: THUMB_WIDTH, height },
      "paper",
      getComputedStyle(document.body).fontFamily,
    );
  }, [entry, height]);

  return (
    <div
      className="border-border relative w-full overflow-hidden rounded-md border bg-white"
      style={{ aspectRatio: `${THUMB_WIDTH} / ${height}` }}
    >
      {src && (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(min-width: 640px) 160px, 30vw"
          className="object-cover"
        />
      )}
      <canvas
        ref={canvas}
        width={THUMB_WIDTH}
        height={height}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
    </div>
  );
}
