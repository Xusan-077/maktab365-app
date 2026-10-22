/** Backend `PDF_BOOK_MAX_BYTES` default'i; server baribir qat'iy tekshiradi (bu — tez fikr-mulohaza). */
export const PDF_MAX_BYTES = 100 * 1024 * 1024;

export type PdfFileProblem = "notPdf" | "empty" | "tooLarge" | "missing";

/** Tanlangan fayl yuklashga yaraydimi: `null` — yaraydi, aks holda `admin.pdfUpload.problems.*` kaliti. */
export function pdfFileProblem(
  file: { name: string; size: number; type: string },
  maxBytes = PDF_MAX_BYTES,
): PdfFileProblem | null {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") && file.type === "application/pdf";
  if (!isPdf) return "notPdf";
  if (file.size <= 0) return "empty";
  if (file.size > maxBytes) return "tooLarge";
  return null;
}
