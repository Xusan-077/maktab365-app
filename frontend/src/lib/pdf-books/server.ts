import { cacheLife, cacheTag } from "next/cache";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { ApiError } from "@/lib/api/types";
import {
  PdfBooksApi,
  type PdfBook,
  type PdfBookDetail,
  type PdfBookFilters,
  type PdfBookPage,
  type PdfSubject,
} from "./api";

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

/**
 * Build paytida backend ishlamasa (tarmoq xatosi, `status: 0`): namunaviy yo'l (`generateStaticParams`)
 * "kitob yo'q" sifatida quriladi va build yiqilmaydi. Runtime'da xato avvalgidek otiladi.
 */
const offlineAtBuild = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 0 &&
  process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

/** Build paytida backend yo'q bo'lsa — bo'sh ro'yxat (sahifa keyingi qayta tekshiruvda to'ladi). */
async function listOrEmptyAtBuild(load: () => Promise<PdfBookPage>): Promise<PdfBook[]> {
  try {
    return (await load()).results;
  } catch (error) {
    if (offlineAtBuild(error)) return [];
    throw error;
  }
}

/** Sinfning hamma kitoblari (`list` natijasi bir so'rovda; sinfda 100 tadan ko'p bo'lmaydi). */
export async function getGradeBooks(grade: number): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  return listOrEmptyAtBuild(() => new PdfBooksApi().list({ grade, pageSize: SERVER_PAGE_SIZE }));
}

/** Fanning hamma sinflardagi kitoblari ("Algebra boshqa sinflarda"). */
export async function getSubjectBooks(subject: string): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  return listOrEmptyAtBuild(() => new PdfBooksApi().list({ subject, pageSize: SERVER_PAGE_SIZE }));
}

/** Eng so'nggi qo'shilgan nashr qilingan kitoblar (kirish sahifasi kollaji). */
export async function getLatestBooks(count: number): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  return listOrEmptyAtBuild(() => new PdfBooksApi().list({ ordering: "newest", pageSize: count }));
}

/** Kitob slug bo'yicha; yo'q yoki ko'rinmasa `null`. */
export async function getBookBySlug(slug: string): Promise<PdfBookDetail | null> {
  "use cache";
  lifetime();
  try {
    return await new PdfBooksApi().bookBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    if (offlineAtBuild(error)) return null;
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
    if (offlineAtBuild(error)) return null;
    throw error;
  }
}

/** Hamma nashr qilingan kitoblar (sitemap): sahifalab olinadi. */
export async function getAllBooks(): Promise<PdfBook[]> {
  "use cache";
  lifetime();
  const api = new PdfBooksApi();
  const books: PdfBook[] = [];
  try {
    for (let page = 1; ; page += 1) {
      const chunk = await api.list({ page, pageSize: SERVER_PAGE_SIZE });
      books.push(...chunk.results);
      if (books.length >= chunk.count || chunk.results.length === 0) return books;
    }
  } catch (error) {
    if (offlineAtBuild(error)) return [];
    throw error;
  }
}

/** PDF darsligi bor fanlar (bosh sahifa: sinf va yo'nalish bo'yicha fanlar soni). */
export async function getSubjects(): Promise<PdfSubject[]> {
  "use cache";
  lifetime();
  try {
    return await new PdfBooksApi().subjects();
  } catch (error) {
    if (offlineAtBuild(error)) return [];
    throw error;
  }
}

/** Katalog sahifasi (`/darsliklar`): filtrlar URL'dan, natija har filtr kombinatsiyasi uchun alohida keshlanadi. */
export async function getCatalogPage(filters: PdfBookFilters): Promise<PdfBookPage> {
  "use cache";
  lifetime();
  return new PdfBooksApi().list(filters);
}
