import { BFF_PREFIX } from "@/lib/auth/config";

/**
 * FAQAT admin: PDF va muqovaning asl faylini yuklab olish. Foydalanuvchi interfeysida yuklab
 * olish yo'q; bu endpoint'lar backend'da `IsAdmin` bilan himoyalangan (editor/begona — 403).
 */
export type DownloadTarget = { kind: "library" | "textbook"; id: string };

const base = (target: DownloadTarget) =>
  `${BFF_PREFIX}/api/v1/admin/${target.kind === "library" ? "books" : "pdf-books"}/${target.id}`;

export class DownloadError extends Error {
  constructor(readonly status: number) {
    super(`download failed: ${status}`);
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** PDF: backend `attachment` URL beradi (R2 imzolangan), brauzer to'g'ridan-to'g'ri yuklaydi. */
export async function downloadPdf(target: DownloadTarget): Promise<void> {
  const response = await fetch(`${base(target)}/download/`, { credentials: "same-origin" });
  if (!response.ok) throw new DownloadError(response.status);
  const data = (await response.json()) as { url: string };
  const link = document.createElement("a");
  // Lokal (dev) rejimda `url` nisbiy backend yo'li: BFF orqali ochiladi.
  link.href = data.url.startsWith("/") ? `${BFF_PREFIX}${data.url}` : data.url;
  link.rel = "noopener";
  link.click();
}

/** Muqova: asl fayl backend'dan `attachment` bo'lib keladi. */
export async function downloadCover(target: DownloadTarget, filename: string): Promise<void> {
  const response = await fetch(`${base(target)}/cover-download/`, { credentials: "same-origin" });
  if (!response.ok) throw new DownloadError(response.status);
  saveBlob(await response.blob(), filename);
}
