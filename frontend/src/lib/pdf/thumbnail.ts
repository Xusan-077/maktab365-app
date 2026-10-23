import { loadPdfjs } from "./pdfjs";

/** Muqova kengligi (px): katalog kartasi va kitob sahifasi uchun yetarli, siqilgan. */
export const COVER_WIDTH = 600;
const COVER_QUALITY = 0.8;

/** Mijoz hajmi: eni `width` bo'lgan viewport masshtabi. */
export function coverScale(pageWidth: number, width = COVER_WIDTH): number {
  return pageWidth > 0 ? width / pageWidth : 1;
}

export type CoverSource = { file: File } | { url: string };

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, COVER_QUALITY));
}

/**
 * PDF'ning 1-sahifasidan muqova rasmi (adminning brauzerida; serverda rasterlash yo'q).
 * WebP (kichikroq); brauzer qo'llamasa JPEG. Manba — tanlangan fayl yoki imzolangan URL.
 */
export async function renderCover(source: CoverSource): Promise<File> {
  const pdfjs = await loadPdfjs();
  const task =
    "file" in source
      ? pdfjs.getDocument({ data: new Uint8Array(await source.file.arrayBuffer()) })
      : pdfjs.getDocument({ url: source.url });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: coverScale(base.width) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.fillStyle = "#ffffff"; // shaffof PDF fon rasmda qora bo'lmasin
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    let blob = await toBlob(canvas, "image/webp");
    if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg");
    if (!blob) throw new Error("Cover rendering failed");
    const webp = blob.type === "image/webp";
    return new File([blob], webp ? "cover.webp" : "cover.jpg", { type: blob.type });
  } finally {
    await task.destroy();
  }
}

export const renderCoverFile = (pdf: File): Promise<File> => renderCover({ file: pdf });
