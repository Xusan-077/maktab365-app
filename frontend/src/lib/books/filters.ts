import { GRADES } from "@/types/catalog";
import type { BookFilters, BookLanguage, ReadingMode } from "./api";
import { BOOKS_PAGE_SIZE } from "./api";

export const BOOK_LANGUAGES: readonly BookLanguage[] = ["uz", "ru", "en"];

export interface BooksUrlFilters {
  /** Tur slug'i (`?tur=badiiy-kitoblar`). */
  type?: string;
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
  const type = typeRaw && /^[a-z0-9-]{1,120}$/.test(typeRaw) ? typeRaw : undefined;
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
  if (filters.type) query.set("tur", filters.type);
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

const TYPE_GROUP: Record<string, string> = {
  "maktab-darsliklari": "natural",
  "badiiy-kitoblar": "language",
  boshqa: "arts",
};
const GROUPS = ["exact", "natural", "language", "social", "arts"] as const;

/** Muqova zaxirasi rangi (`globals.css` `--group-*`): o'qish rejimi yoki tur slug'idan. */
export function bookGroup(typeSlug: string, mode: ReadingMode): string {
  if (mode === "math") return "exact";
  if (mode === "test") return "social";
  const known = TYPE_GROUP[typeSlug];
  if (known) return known;
  let hash = 0;
  for (const char of typeSlug) hash = (hash * 31 + char.charCodeAt(0)) % GROUPS.length;
  return GROUPS[hash];
}
