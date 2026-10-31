import type { Annotation } from "./annotations";
import { renderAll } from "./annotation-render";
import type { PageEntry } from "./api";
import { buildZip } from "./zip";

/** Yozuvlarni yuklab olish: bet (PNG, annotatsiyalari bilan), yon daftar (.md), kitob (.zip). */

/** Eksport rasmi eni chegarasi (px): katta sahifalar xotirani to'ldirmasin. */
export const EXPORT_MAX_WIDTH = 2000;
/** Bitta ZIP'dagi betlar soni chegarasi (brauzer xotirasi va kutish vaqti). */
export const EXPORT_MAX_PAGES = 40;

/** Fayl nomiga yaroqli qisqa qism: harf/raqam (Unicode), qolgani "-". */
export function fileSlug(value: string, fallback = "kitob"): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export const pageFileName = (title: string, page: number, extension: "png" | "md") =>
  `${fileSlug(title)}-bet-${page}.${extension}`;

/** Chiqish o'lchami: eni `maxWidth` dan oshmaydi, nisbat saqlanadi (kichik rasm kattalashtirilmaydi). */
export function exportSize(
  width: number,
  height: number,
  maxWidth = EXPORT_MAX_WIDTH,
): { width: number; height: number } {
  if (width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * scale) };
}

export interface NoteSource {
  page: number;
  text: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

/** Bitta betning yon daftari (.md). */
export function pageNoteMarkdown(title: string, source: NoteSource, pageLabel: string): string {
  return `# ${title}\n\n## ${pageLabel}\n\n${source.text.trim()}\n`;
}

/** Kitobning barcha yon daftarlari (.md): har bet alohida bo'lim, bet tartibida. */
export function bookNotesMarkdown(
  title: string,
  entries: readonly Pick<PageEntry, "page" | "note" | "annotations">[],
  labels: { page: (page: number) => string; texts: string },
): string {
  const sorted = [...entries].sort((a, b) => a.page - b.page);
  const parts = [`# ${title}\n`];
  for (const entry of sorted) {
    const note = entry.note.trim();
    const labelsOnPage = entry.annotations
      .map((item) => (item.data as { text?: unknown } | null)?.text)
      .filter((value): value is string => isNonEmptyString(value));
    if (note === "" && labelsOnPage.length === 0) continue;
    parts.push(`## ${labels.page(entry.page)}\n`);
    if (note !== "") parts.push(`${note}\n`);
    if (labelsOnPage.length > 0) {
      parts.push(`**${labels.texts}**\n\n${labelsOnPage.map((text) => `- ${text}`).join("\n")}\n`);
    }
  }
  return parts.join("\n");
}

/** Sahifa rasmi + annotatsiyalar → PNG (brauzer canvas'i). */
export async function renderAnnotatedPage(
  image: Blob,
  items: readonly Annotation[],
  theme: "paper" | "sepia" | "night" = "paper",
): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const size = exportSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    renderAll(ctx, items, size, theme, getComputedStyle(document.body).fontFamily);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("export_failed"))),
        "image/png",
      );
    });
  } finally {
    bitmap.close();
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const textBlob = (value: string, type = "text/markdown") =>
  new Blob([value], { type: `${type};charset=utf-8` });

export interface ZipEntryInput {
  name: string;
  blob: Blob;
}

/** Blob'lardan ZIP (store). */
export async function zipBlobs(files: readonly ZipEntryInput[]): Promise<Blob> {
  const data = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      data: new Uint8Array(await file.blob.arrayBuffer()),
    })),
  );
  return new Blob([buildZip(data) as BlobPart], { type: "application/zip" });
}
