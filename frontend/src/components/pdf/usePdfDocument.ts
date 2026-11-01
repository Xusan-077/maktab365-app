"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loadOfflinePdf } from "@/lib/offline/pdf-cache";
import { resolveFileUrl } from "@/lib/pdf/file-url";
import { autoRetriable, classifyPdfError, PdfLoadTimeoutError } from "@/lib/pdf/load-error";
import {
  loadPdfjs,
  pdfjsAssetOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "@/lib/pdf/pdfjs";
import { bookQueries } from "@/lib/books/queries";
import { pdfQueries } from "@/lib/pdf-books/queries";

/** Bir so'rovda shuncha bayt (HTTP Range): kitob to'liq yuklanishini kutmaydi. */
const RANGE_CHUNK_BYTES = 256 * 1024;
/**
 * Hujjat (URL olish + PDF sarlavhasi va 1-bo'lak) shu vaqt ichida ochilmasa — tushunarli
 * «juda uzoq yuklanyapti» xatosi (aks holda skelet cheksiz aylanib turardi).
 */
export const PDF_LOAD_TIMEOUT_MS = 30_000;

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
function usePdfFromUrl(
  sourceKey: string,
  fetchSource: () => Promise<{ url: string } | { data: Uint8Array }>,
  enabled = true,
) {
  const [state, setState] = useState<DocumentState>({ doc: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(fetchSource);
  useEffect(() => {
    loader.current = fetchSource;
  });

  /** Imzolangan URL eskirgan bo'lsa bir marta jim qayta uriniladi (har yangi manba uchun). */
  const silentRetries = useRef(0);
  useEffect(() => {
    silentRetries.current = 0;
  }, [sourceKey]);

  useEffect(() => {
    // O'chiq: boshqa turdagi kitob uchun hook chaqirilgan, hech narsa yuklanmaydi (holati ishlatilmaydi).
    if (!enabled) return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    const fail = (error: unknown) => {
      if (cancelled) return;
      cancelled = true;
      void task?.destroy();
      if (autoRetriable(classifyPdfError(error)) && silentRetries.current < 1) {
        silentRetries.current += 1;
        setAttempt((count) => count + 1);
        return;
      }
      setState({ doc: null, loading: false, error });
    };
    const timer = window.setTimeout(() => fail(new PdfLoadTimeoutError()), PDF_LOAD_TIMEOUT_MS);
    void (async () => {
      try {
        const [pdfjs, file] = await Promise.all([loadPdfjs(), loader.current()]);
        if (cancelled) return;
        // Oflayn saqlangan nusxa (butun fayl xotirada) yoki imzolangan URL (Range bilan bo'laklab).
        task =
          "data" in file
            ? pdfjs.getDocument({ data: file.data, ...pdfjsAssetOptions() })
            : pdfjs.getDocument({
                url: resolveFileUrl(file.url, window.location.origin),
                ...pdfjsAssetOptions(),
                rangeChunkSize: RANGE_CHUNK_BYTES,
                disableAutoFetch: true,
                // Oqim o'chiq: pdf.js sarlavhadan so'ng birinchi so'rovni darhol uzadi (aks holda butun fayl keladi).
                disableStream: true,
              });
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        window.clearTimeout(timer);
        silentRetries.current = 0;
        setState({ doc, loading: false, error: null });
      } catch (error) {
        window.clearTimeout(timer);
        if (cancelled) return;
        console.error("[pdf] hujjatni ochib bo'lmadi", error);
        fail(error);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void task?.destroy();
      // Yo'q qilingan hujjat state'da qolmasin: Next `<Activity>` sahifani yashirib keyin qaytarganda
      // (orqaga navigatsiya) bolalar eski `doc.getPage` ni chaqirib yiqilardi.
      setState({ doc: null, loading: true, error: null });
    };
  }, [sourceKey, attempt, enabled]);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setAttempt((count) => count + 1);
  }, []);

  // Xato holatida internet qaytsa — o'zi qayta yuklanadi (foydalanuvchi tugma bosishi shart emas).
  const failed = enabled && state.error !== null && state.doc === null;
  useEffect(() => {
    if (!failed) return;
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, [failed, reload]);

  return { ...state, reload };
}

/** Kitob PDF'i. */
export function usePdfDocument(bookId: string, enabled = true) {
  const queryClient = useQueryClient();
  return usePdfFromUrl(
    `book:${bookId}`,
    async () => {
      // Oflayn saqlangan bo'lsa tarmoqsiz va trafiksiz shu nusxa ochiladi.
      const saved = await loadOfflinePdf(bookId);
      if (saved) return { data: saved };
      return queryClient.fetchQuery(pdfQueries.fileUrl(bookId));
    },
    enabled,
  );
}

/**
 * Kutubxona kitobi (`/kitoblar`): shu mexanizm, lekin imzolangan URL `books/<id>/file-url/` dan.
 * Oflayn nusxa yo'q.
 */
export function useLibraryBookDocument(bookId: string, enabled = true) {
  const queryClient = useQueryClient();
  return usePdfFromUrl(
    `library:${bookId}`,
    () => queryClient.fetchQuery(bookQueries.fileUrl(bookId)),
    enabled,
  );
}

/** Bo'lim prezentatsiyasi (PDF slaydlar): kitob PDF'i bilan bir xil mexanizm. */
export function useSlidesDocument(bookId: string, chapterId: string) {
  const queryClient = useQueryClient();
  return usePdfFromUrl(`slides:${bookId}:${chapterId}`, () =>
    queryClient.fetchQuery(pdfQueries.slidesUrl(bookId, chapterId)),
  );
}
