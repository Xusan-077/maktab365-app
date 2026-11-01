import { cacheLife, cacheTag } from "next/cache";
import { ApiError } from "@/lib/api/types";
import { BooksApi, type BookDetail, type BookFilters, type BooksPage } from "./api";

/**
 * Ochiq sahifalar uchun serverda keshlanadigan o'qishlar (faqat nashr qilingan kitoblar).
 * Kesh `books` tegi bilan, aks holda 5 daqiqada yangilanadi.
 */
function lifetime() {
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  // `pdf-books` — admin yozuvidan keyin BFF shu tegni yangilaydi (`lib/auth/bff.ts`).
  cacheTag("books", "pdf-books");
}

export async function getBooksPage(filters: BookFilters): Promise<BooksPage> {
  "use cache";
  lifetime();
  return new BooksApi().list(filters);
}

/** Kitob id bo'yicha; yo'q yoki ko'rinmasa `null`. */
export async function getBook(id: string): Promise<BookDetail | null> {
  "use cache";
  lifetime();
  try {
    return await new BooksApi().book(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
