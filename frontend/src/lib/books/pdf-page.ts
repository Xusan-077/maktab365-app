"use client";

import { useEffect, useState } from "react";
import { renderPixelRatio } from "@/lib/pdf/book";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { textFlow } from "@/lib/pdf/text-flow";

/** Fizik piksellar zichligi chegarasi (`PdfPageCanvas` bilan bir xil): xotirani tejaydi. */
export const MAX_PIXEL_RATIO = 2;

export interface PageSize {
  width: number;
  height: number;
}

/**
 * Betning `PageRenderPool` kaliti uchun masshtab: `PdfPageCanvas` bilan bir xil formula
 * (CSS eni `width`ga moslanadi, zichlik `devicePixelRatio ≤ 2`). Oldindan chizilgan bet
 * shu masshtab bilan topilsa keshdan darhol chiqadi.
 */
export function pageCanvasScale(
  natural: PageSize,
  width: number,
  devicePixelRatio: number,
): number {
  const fit = Math.floor(width) / natural.width;
  const css = { width: natural.width * fit, height: natural.height * fit };
  const ratio = renderPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO), 1, css);
  return Number((fit * ratio).toFixed(3));
}

/**
 * Betning tabiiy o'lchami (PDF birliklarida, burilish hisobga olingan). Bet almashganda yangisi
 * kelguncha oldingisi qoladi (joylashuv bir lahza eski nisbatda turadi, "sakramaydi").
 */
export function useNaturalPageSize(doc: PDFDocumentProxy | null, page: number): PageSize | null {
  const [size, setSize] = useState<PageSize | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void doc
      .getPage(page)
      .then((proxy) => {
        if (cancelled) return;
        const view = proxy.getViewport({ scale: 1 });
        setSize((current) =>
          current && current.width === view.width && current.height === view.height
            ? current
            : { width: view.width, height: view.height },
        );
      })
      .catch(() => undefined); // xato `PdfPageCanvas`da ko'rsatiladi
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  return size;
}

export interface PageTextState {
  status: "loading" | "ready" | "error";
  text: string;
  retry: () => void;
}

/** Betning matni (PDF matn qatlamidan): qator va xatboshilar saqlanadi. */
export function usePageText(doc: PDFDocumentProxy | null, page: number): PageTextState {
  const [attempt, setAttempt] = useState(0);
  const key = `${page}:${attempt}`;
  const [result, setResult] = useState<{ key: string; text: string | null } | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void doc
      .getPage(page)
      .then((proxy) => proxy.getTextContent())
      .then((content) => {
        if (!cancelled) setResult({ key, text: textFlow(content.items) });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, text: null });
      });
    return () => {
      cancelled = true;
    };
  }, [doc, page, key]);

  const retry = () => setAttempt((value) => value + 1);
  const current = result?.key === key ? result : null;
  if (!current) return { status: "loading", text: "", retry };
  if (current.text === null) return { status: "error", text: "", retry };
  return { status: "ready", text: current.text, retry };
}
