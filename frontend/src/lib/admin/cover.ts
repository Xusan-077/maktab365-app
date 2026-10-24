import type { AdminApi } from "@/lib/admin/api";
import type { AdminPdfBook } from "@/lib/admin/types";
import { renderCover, shrinkCoverImage } from "@/lib/pdf/thumbnail";

export type CoverMode = "auto" | "first_page" | "custom";

/** Admin tanlovi: avtomatik, PDF 1-beti yoki o'z rasmi (`image`). */
export interface CoverChoice {
  mode: CoverMode;
  image: File | null;
}

export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Backend `ADMIN_UPLOAD_MAX_IMAGE_BYTES` bilan mos emas bo'lsa, server 413 qaytaradi; bu oldindan tekshiruv. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export type CoverImageProblem = "type" | "size";

export function coverImageProblem(file: File): CoverImageProblem | null {
  if (!(COVER_IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > COVER_MAX_BYTES) return "size";
  return null;
}

/**
 * Oldindan ko'rishdagi muqova: admin API'dagi joriy rejim va rasm (ochiq API'ning keshlangan
 * nusxasi emas). `auto` yoki rasm yo'q — `null` (generativ muqova).
 */
export function previewCover(book: Pick<AdminPdfBook, "cover_mode" | "cover_url">): string | null {
  return book.cover_mode && book.cover_mode !== "auto" && book.cover_url ? book.cover_url : null;
}

type CoverApi = Pick<AdminApi, "upload" | "updatePdfBook">;

/**
 * Tanlangan muqovani kitobga qo'llaydi: rasm saqlashga yuklanadi, so'ng rejim bilan `PATCH`
 * (eski rasm backendda tozalanadi). `pdf` — `first_page` uchun manba: yangi fayl yoki saqlangan PDF URL'i.
 */
export async function applyCover(
  api: CoverApi,
  bookId: string,
  choice: CoverChoice,
  pdf?: { file: File } | { url: string },
): Promise<AdminPdfBook> {
  if (choice.mode === "auto") return api.updatePdfBook(bookId, { cover_mode: "auto" });
  let image: File;
  if (choice.mode === "custom") {
    if (!choice.image) throw new Error("Cover image is required");
    image = await shrinkCoverImage(choice.image);
  } else {
    if (!pdf) throw new Error("PDF source is required");
    image = await renderCover(pdf);
  }
  const uploaded = await api.upload(image, "cover");
  return api.updatePdfBook(bookId, { cover_mode: choice.mode, cover: uploaded.path });
}
