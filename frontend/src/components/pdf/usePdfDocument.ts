"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolveFileUrl } from "@/lib/pdf/file-url";
import { loadPdfjs, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { pdfQueries } from "@/lib/pdf-books/queries";

/** Bir so'rovda shuncha bayt (HTTP Range): kitob to'liq yuklanishini kutmaydi. */
const RANGE_CHUNK_BYTES = 256 * 1024;

interface DocumentState {
  doc: PDFDocumentProxy | null;
  loading: boolean;
  error: unknown;
}

/**
 * PDF'ni qisqa muddatli URL bilan ochadi (pdf.js Range orqali kerakli bo'laklarni oladi;
 * `disableAutoFetch` — qolgan sahifalar oldindan yuklanmaydi). `reload` yangi imzolangan URL
 * oladi: URL muddati tugagach keyingi Range so'rovlari rad etilsa shu bilan tiklanadi.
 * `sourceKey` o'zgarsa (boshqa fayl) hujjat qayta ochiladi.
 */
function usePdfFromUrl(sourceKey: string, fetchUrl: () => Promise<{ url: string }>) {
  const [state, setState] = useState<DocumentState>({ doc: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(fetchUrl);
  useEffect(() => {
    loader.current = fetchUrl;
  });

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    void (async () => {
      try {
        const [pdfjs, file] = await Promise.all([loadPdfjs(), loader.current()]);
        if (cancelled) return;
        task = pdfjs.getDocument({
          url: resolveFileUrl(file.url, window.location.origin),
          rangeChunkSize: RANGE_CHUNK_BYTES,
          disableAutoFetch: true,
        });
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        setState({ doc, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState({ doc: null, loading: false, error });
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [sourceKey, attempt]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setAttempt((count) => count + 1);
  }, []);

  return { ...state, reload };
}

/** Kitob PDF'i. */
export function usePdfDocument(bookId: string) {
  const queryClient = useQueryClient();
  return usePdfFromUrl(`book:${bookId}`, () => queryClient.fetchQuery(pdfQueries.fileUrl(bookId)));
}

/** Bo'lim prezentatsiyasi (PDF slaydlar): kitob PDF'i bilan bir xil mexanizm. */
export function useSlidesDocument(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return usePdfFromUrl(`slides:${bookId}:${chapterId}`, () =>
    queryClient.fetchQuery(pdfQueries.slidesUrl(bookId, chapterId)),
  );
}
