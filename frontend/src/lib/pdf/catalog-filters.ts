import type { PdfBookFilters } from "@/lib/pdf-books/api";
import { GRADES } from "@/types/catalog";
import { GROUP_URL, SUBJECT_GROUPS, type SubjectGroup } from "./grade-groups";

/** `/darsliklar` katalogi: filtrlar URL'da (server render qiladi), qiymatlar o'zbekcha qisqa nomlar bilan. */
export const CATALOG_PAGE_SIZE = 24;

export const CATALOG_LANGUAGES = ["uz", "ru", "en"] as const;
export type CatalogLanguage = (typeof CATALOG_LANGUAGES)[number];

export type CatalogSort = "grade" | "newest";

export interface CatalogFilters {
  grade?: number;
  /** Fan slug'i (`/fanlar` dan keladi); katalog panelida boshqaruvi yo'q, faqat belgi sifatida. */
  subject?: string;
  groups: SubjectGroup[];
  language?: CatalogLanguage;
  q?: string;
  sort: CatalogSort;
  page: number;
}

export const EMPTY_FILTERS: CatalogFilters = { groups: [], sort: "grade", page: 1 };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

const SUBJECT_SLUG = /^[a-z0-9-]{1,80}$/;
const MAX_QUERY_LENGTH = 100;

/** URL parametrlari → filtrlar; noto'g'ri qiymatlar jimgina tashlanadi. */
export function parseCatalogFilters(raw: RawParams): CatalogFilters {
  const gradeRaw = first(raw.sinf);
  const grade = gradeRaw && /^\d{1,2}$/.test(gradeRaw) ? Number(gradeRaw) : undefined;
  const subject = first(raw.fan);
  const language = first(raw.til) as CatalogLanguage | undefined;
  const pageRaw = first(raw.bet);
  const page = pageRaw && /^\d{1,4}$/.test(pageRaw) ? Number(pageRaw) : 1;
  const wanted = new Set(
    (Array.isArray(raw.guruh) ? raw.guruh : [raw.guruh ?? ""]).flatMap((value) => value.split(",")),
  );

  return {
    grade: grade && (GRADES as readonly number[]).includes(grade) ? grade : undefined,
    subject: subject && SUBJECT_SLUG.test(subject) ? subject : undefined,
    groups: SUBJECT_GROUPS.filter((group) => wanted.has(GROUP_URL[group])),
    language: language && CATALOG_LANGUAGES.includes(language) ? language : undefined,
    q: first(raw.q)?.slice(0, MAX_QUERY_LENGTH),
    sort: first(raw.tartib) === "yangi" ? "newest" : "grade",
    page: Math.max(1, page),
  };
}

/** Filtrlar → query string (kanonik tartib: bir xil filtr — bir xil URL, keshga qulay). */
export function catalogQuery(filters: CatalogFilters): string {
  const query = new URLSearchParams();
  if (filters.grade) query.set("sinf", String(filters.grade));
  if (filters.subject) query.set("fan", filters.subject);
  if (filters.groups.length > 0) {
    const ordered = SUBJECT_GROUPS.filter((group) => filters.groups.includes(group));
    query.set("guruh", ordered.map((group) => GROUP_URL[group]).join(","));
  }
  if (filters.language) query.set("til", filters.language);
  if (filters.q) query.set("q", filters.q);
  if (filters.sort === "newest") query.set("tartib", "yangi");
  if (filters.page > 1) query.set("bet", String(filters.page));
  return query.toString();
}

/** `path` + query; filtr o'zgarsa `page` 1 ga qaytariladi (chaqiruvchi `patch` da `page` bermasa). */
export function catalogHref(
  path: string,
  filters: CatalogFilters,
  patch: Partial<CatalogFilters> = {},
) {
  const next: CatalogFilters = { ...filters, page: 1, ...patch };
  const query = catalogQuery(next);
  return query ? `${path}?${query}` : path;
}

/** Filtrlar o'zgarganda filtr panelini qayta qurish uchun `key` (panel holati URL'dan boshlanadi). */
export const catalogFiltersKey = (filters: CatalogFilters) => JSON.stringify(filters);

/** Faol filtrlar soni (saralash va sahifa hisobga olinmaydi) — mobil "Filtrlar" tugmasidagi belgi uchun. */
export function activeFilterCount(filters: CatalogFilters): number {
  return (
    (filters.grade ? 1 : 0) +
    (filters.subject ? 1 : 0) +
    filters.groups.length +
    (filters.language ? 1 : 0) +
    (filters.q ? 1 : 0)
  );
}

/** Backend so'rovi uchun filtrlar. */
export function toApiFilters(filters: CatalogFilters): PdfBookFilters {
  return {
    grade: filters.grade,
    subject: filters.subject,
    groups: filters.groups.length > 0 ? [...filters.groups] : undefined,
    language: filters.language,
    q: filters.q,
    ordering: filters.sort === "newest" ? "newest" : undefined,
    page: filters.page > 1 ? filters.page : undefined,
    pageSize: CATALOG_PAGE_SIZE,
  };
}
