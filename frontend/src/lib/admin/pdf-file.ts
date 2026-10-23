export type PdfFileProblem = "notPdf" | "empty" | "missing";

/**
 * Tanlangan fayl yuklashga yaraydimi: `null` — yaraydi, aks holda `admin.pdfUpload.problems.*` kaliti.
 * Hajm bo'yicha chegara yo'q (server `PDF_BOOK_MAX_BYTES` berilgan bo'lsagina tekshiradi).
 */
export function pdfFileProblem(file: {
  name: string;
  size: number;
  type: string;
}): PdfFileProblem | null {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") && file.type === "application/pdf";
  if (!isPdf) return "notPdf";
  if (file.size <= 0) return "empty";
  return null;
}
