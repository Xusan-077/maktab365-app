"use client";

import { getBooksApi } from "@/lib/books/api";
import {
  loadPdfjs,
  pdfjsAssetOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "@/lib/pdf/pdfjs";
import { resolveFileUrl } from "@/lib/pdf/file-url";

/** Eksport uchun bet rasmi eni (px): annotatsiyalar shu o'lchamda chiziladi. */
export const EXPORT_PAGE_WIDTH = 1400;
/** Xotirada shuncha kitob hujjati saqlanadi (eksport/eskizlar bir kitobni qayta-qayta ochmasin). */
const DOC_CACHE_SIZE = 2;

interface OpenDocument {
  promise: Promise<PDFDocumentProxy>;
  /** Hujjat keshdan chiqarilganda yuklash vazifasi yopiladi (worker xotirasi bo'shaydi). */
  close: () => void;
}

const docs = new Map<string, OpenDocument>();

function openDocument(bookId: string): OpenDocument {
  let task: PDFDocumentLoadingTask | undefined;
  let closed = false;
  const promise = (async () => {
    const [pdfjs, file] = await Promise.all([loadPdfjs(), getBooksApi().fileUrl(bookId)]);
    task = pdfjs.getDocument({
      url: resolveFileUrl(file.url, window.location.origin),
      ...pdfjsAssetOptions(),
      rangeChunkSize: 256 * 1024,
      disableAutoFetch: true,
      // Oqim o'chiq: pdf.js sarlavhadan so'ng birinchi so'rovni darhol uzadi (aks holda butun fayl keladi).
      disableStream: true,
    });
    if (closed) void task.destroy();
    return task.promise;
  })();
  return {
    promise,
    close: () => {
      closed = true;
      void task?.destroy();
    },
  };
}

/** Kitob hujjati (kesh bilan): xato bo'lsa keshdan olib tashlanadi, keyingi chaqiriq qayta urinadi. */
export function libraryDocument(bookId: string): Promise<PDFDocumentProxy> {
  const cached = docs.get(bookId);
  if (cached) {
    docs.delete(bookId); // LRU: oxiriga ko'chiriladi
    docs.set(bookId, cached);
    return cached.promise;
  }
  const opening = openDocument(bookId);
  docs.set(bookId, opening);
  opening.promise.catch(() => {
    if (docs.get(bookId) === opening) docs.delete(bookId);
  });
  while (docs.size > DOC_CACHE_SIZE) {
    const [oldest] = docs.keys();
    docs.get(oldest)?.close();
    docs.delete(oldest);
  }
  return opening.promise;
}

/** Betni berilgan enda (px) oq fonli PNG/WebP `Blob`ga chizadi. */
export async function renderPageBlob(
  doc: PDFDocumentProxy,
  page: number,
  width: number,
  type: "image/png" | "image/webp" = "image/png",
): Promise<Blob> {
  const proxy = await doc.getPage(page);
  const natural = proxy.getViewport({ scale: 1 });
  const viewport = proxy.getViewport({ scale: width / natural.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.fillStyle = "#ffffff"; // shaffof PDF fon rasmda qora bo'lmasin
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    await proxy.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    if (!blob) throw new Error("Page rendering failed");
    return blob;
  } finally {
    canvas.width = canvas.height = 0; // Safari: canvas xotirasini darhol bo'shatadi
  }
}

/** Bet rasmi (eksport uchun): bet PDF'ning o'zidan brauzerda chiziladi (serverda tayyor rasm yo'q). */
export async function fetchPageImage(bookId: string, page: number): Promise<Blob> {
  return renderPageBlob(await libraryDocument(bookId), page, EXPORT_PAGE_WIDTH);
}
