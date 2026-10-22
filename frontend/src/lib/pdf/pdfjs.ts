/**
 * pdf.js faqat brauzerda va faqat kerak bo'lganda yuklanadi (SSR'da import qilinmaydi, asosiy
 * bundle'ga kirmaydi). Worker alohida fayl sifatida bundler tomonidan chiqariladi.
 * `legacy` build: yangi brauzer API'lariga (masalan `Map.getOrInsertComputed`) tayanmaydi, shuning
 * uchun eski telefonlarda ham ishlaydi.
 */
import type * as Pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

type PdfjsModule = typeof Pdfjs;

let loading: Promise<PdfjsModule> | undefined;

export function loadPdfjs(): Promise<PdfjsModule> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return loading;
}

export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
