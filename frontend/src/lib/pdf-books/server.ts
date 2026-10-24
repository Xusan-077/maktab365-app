import { cacheLife, cacheTag } from "next/cache";
import { ApiError } from "@/lib/api/types";
import { PdfBooksApi, type PdfBook, type PdfBookDetail } from "./api";

/** Backend chegarasi (`max_page_size`): bir so'rovda shuncha kitob. */
const SERVER_PAGE_SIZE = 100;

/**
 * Ochiq sahifalar (sinf, kitob, sitemap) uchun serverda keshlanadigan o'qishlar. Kesh `pdf-books`
 * tegi bilan (kerak bo'lsa `revalidateTag`), aks holda 5 daqiqada yangilanadi.
 * Faqat nashr qilingan kitoblar (tokensiz so'rov); qoralamalar staff ko'rinishida mijozda ochiladi.
 */
function lifetime() {
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("pdf-books");
}

/** Sinfning hamma kitoblari (`list` natijasi bir so'rovda; sinfda 100 tadan ko'p bo'lmaydi). */
export async function getGradeBooks(grade: number): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  const page = await new PdfBooksApi().list({ grade, pageSize: SERVER_PAGE_SIZE });
  return page.results;
}

/** Eng so'nggi qo'shilgan nashr qilingan kitoblar (kirish sahifasi kollaji). */
export async function getLatestBooks(count: number): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  const page = await new PdfBooksApi().list({ ordering: "newest", pageSize: count });
  return page.results;
}

/** Kitob slug bo'yicha; yo'q yoki ko'rinmasa `null`. */
export async function getBookBySlug(slug: string): Promise<PdfBookDetail | null> {
  "use cache";
  lifetime();
  try {
    return await new PdfBooksApi().bookBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Kitob id bo'yicha (eski `/darsliklar/<uuid>` havolalarini yo'naltirish uchun). */
export async function getBookById(id: string): Promise<PdfBookDetail | null> {
  "use cache";
  lifetime();
  try {
    return await new PdfBooksApi().book(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Hamma nashr qilingan kitoblar (sitemap): sahifalab olinadi. */
export async function getAllBooks(): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  const api = new PdfBooksApi();
  const books: PdfBook[] = [];
  for (let page = 1; ; page += 1) {
    const chunk = await api.list({ page, pageSize: SERVER_PAGE_SIZE });
    books.push(...chunk.results);
    if (books.length >= chunk.count || chunk.results.length === 0) return books;
  }
}
