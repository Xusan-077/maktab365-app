import { GRADES } from "@/types/catalog";
import type { BookFilters, BookLanguage, BookType } from "./api";
import { BOOKS_PAGE_SIZE } from "./api";

/** Tur → URL qiymati (`/kitoblar?tur=badiiy`). Tartib — tablar tartibi. */
export const BOOK_TYPE_URL = {
  textbook: "darslik",
  fiction: "badiiy",
  math: "matematika",
  test: "test",
  other: "boshqa",
} as const satisfies Record<BookType, string>;

export const BOOK_TYPES = Object.keys(BOOK_TYPE_URL) as BookType[];
export const BOOK_LANGUAGES: readonly BookLanguage[] = ["uz", "ru", "en"];

export interface BooksUrlFilters {
  type?: BookType;
  grade?: number;
  language?: BookLanguage;
  q?: string;
  page: number;
}

export const EMPTY_BOOK_FILTERS: BooksUrlFilters = { page: 1 };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

const MAX_QUERY_LENGTH = 100;

/** URL parametrlari → filtrlar; noto'g'ri qiymatlar jimgina tashlanadi. */
export function parseBookFilters(raw: RawParams): BooksUrlFilters {
  const typeRaw = first(raw.tur);
  const type = BOOK_TYPES.find((value) => BOOK_TYPE_URL[value] === typeRaw);
  const gradeRaw = first(raw.sinf);
  const grade = gradeRaw && /^\d{1,2}$/.test(gradeRaw) ? Number(gradeRaw) : undefined;
  const language = first(raw.til) as BookLanguage | undefined;
  const pageRaw = first(raw.bet);
  const page = pageRaw && /^\d{1,4}$/.test(pageRaw) ? Number(pageRaw) : 1;
  return {
    type,
    grade: grade && (GRADES as readonly number[]).includes(grade) ? grade : undefined,
    language: language && BOOK_LANGUAGES.includes(language) ? language : undefined,
    q: first(raw.q)?.slice(0, MAX_QUERY_LENGTH),
    page: Math.max(1, page),
  };
}

/** Filtrlar → query string (kanonik tartib: bir xil filtr — bir xil URL). */
export function bookQuery(filters: BooksUrlFilters): string {
  const query = new URLSearchParams();
  if (filters.type) query.set("tur", BOOK_TYPE_URL[filters.type]);
  if (filters.grade) query.set("sinf", String(filters.grade));
  if (filters.language) query.set("til", filters.language);
  if (filters.q) query.set("q", filters.q);
  if (filters.page > 1) query.set("bet", String(filters.page));
  return query.toString();
}

/** `patch` qo'llangan filtrlar uchun havola; filtr o'zgarsa sahifa 1 ga qaytadi. */
export function booksHref(
  base: string,
  filters: BooksUrlFilters,
  patch: Partial<BooksUrlFilters> = {},
): string {
  const next = { ...filters, ...patch, page: patch.page ?? 1 };
  const query = bookQuery(next);
  return query ? `${base}?${query}` : base;
}

export const activeBookFilterCount = (filters: BooksUrlFilters) =>
  [filters.grade, filters.language, filters.q].filter(Boolean).length;

export function toBooksApiFilters(filters: BooksUrlFilters): BookFilters {
  return {
    type: filters.type,
    grade: filters.grade,
    language: filters.language,
    q: filters.q,
    page: filters.page,
    pageSize: BOOKS_PAGE_SIZE,
  };
}

/** Tur → fan yo'nalishi rangi (`globals.css` `--group-*`): muqova zaxirasi va belgi. */
export const BOOK_TYPE_GROUP = {
  textbook: "natural",
  fiction: "language",
  math: "exact",
  test: "social",
  other: "arts",
} as const satisfies Record<BookType, string>;
