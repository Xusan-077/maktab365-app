import { loadPdfjs } from "./pdfjs";

/** Muqova kengligi (px): katalog kartasi uchun yetarli, ~30–60 KB. */
export const COVER_WIDTH = 480;
const COVER_QUALITY = 0.82;

/** Mijoz hajmi: eni `width` bo'lgan viewport masshtabi. */
export function coverScale(pageWidth: number, width = COVER_WIDTH): number {
  return pageWidth > 0 ? width / pageWidth : 1;
}

/**
 * PDF'ning 1-sahifasidan JPEG muqova (adminning brauzerida; serverda rasterlash yo'q).
 * Fayl `ArrayBuffer` sifatida o'qiladi (faqat shu fayl — admin allaqachon uni tanlagan).
 */
export async function renderCoverFile(pdf: File): Promise<File> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
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
    context.fillStyle = "#ffffff"; // shaffof PDF fon JPEG'da qora bo'lmasin
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", COVER_QUALITY),
    );
    if (!blob) throw new Error("Cover rendering failed");
    return new File([blob], "cover.jpg", { type: "image/jpeg" });
  } finally {
    await task.destroy();
  }
}
