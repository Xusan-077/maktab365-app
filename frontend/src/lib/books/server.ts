import { cacheLife, cacheTag } from "next/cache";
import { ApiError } from "@/lib/api/types";
import {
  BooksApi,
  type Book,
  type BookDetail,
  type BookFilters,
  type BooksPage,
  type BookTypeInfo,
} from "./api";

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

/** Kitob slug bo'yicha; yo'q yoki ko'rinmasa `null`. */
export async function getBookBySlug(slug: string): Promise<BookDetail | null> {
  "use cache";
  lifetime();
  try {
    return await new BooksApi().bookBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Faol turlar (kitob soni bilan); xatoda bo'sh ro'yxat (tablar yo'qoladi, sahifa ishlaydi). */
export async function getBookTypes(): Promise<BookTypeInfo[]> {
  "use cache";
  lifetime();
  try {
    return await new BooksApi().types();
  } catch {
    return [];
  }
}

/** Sitemap uchun: barcha nashr qilingan kitoblar (sahifalab; xatoda bo'sh ro'yxat). */
export async function getAllLibraryBooks(): Promise<Book[]> {
  "use cache";
  lifetime();
  const api = new BooksApi();
  const all: Book[] = [];
  try {
    for (let page = 1; page <= SITEMAP_MAX_PAGES; page += 1) {
      const chunk = await api.list({ page, pageSize: SITEMAP_PAGE_SIZE });
      all.push(...chunk.results);
      if (all.length >= chunk.count) break;
    }
  } catch {
    return all;
  }
  return all;
}

const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_PAGES = 100;
