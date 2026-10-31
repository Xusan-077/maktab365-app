"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { renderAll } from "@/lib/books/annotation-render";
import { parsedAnnotations } from "@/lib/books/entries";
import type { PageEntry } from "@/lib/books/api";

const THUMB_WIDTH = 240;

/** Bet eskizi + chizma/belgilash/matn qatlami (eksportdagi bilan bir xil chizish kodi). */
export function EntryThumb({ entry, alt }: { entry: PageEntry; alt: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = entry.image;
  const aspect = image && image.width > 0 ? image.height / image.width : 1.4;
  const height = Math.round(THUMB_WIDTH * aspect);
  const src = image ? image.thumbnail || image.image : null;

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
