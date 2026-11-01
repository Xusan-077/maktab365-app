import { parseAnnotations, type Annotation } from "./annotations";
import type { PageEntry, PageEntryType } from "./api";

/** «Mening yozuvlarim»: filtr (URL'da), guruhlash va yozuv holati bilan ishlovchi sof mantiq. */

export const ENTRY_TYPES = [
  "note",
  "highlight",
  "drawing",
  "text",
  "solution",
  "bookmark",
] as const satisfies readonly PageEntryType[];
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRIES_PAGE_SIZE = 20;
export const ENTRIES_QUERY_MIN = 2;

export interface EntryFilters {
  book?: string;
  type?: EntryType;
  /** Belgilash rangi (`#rrggbb`, kichik harf). */
  color?: string;
  q?: string;
}

export const EMPTY_ENTRY_FILTERS: EntryFilters = {};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** URL (`?kitob=&tur=&rang=&q=`) → filtr; noto'g'ri qiymat jim tashlanadi. */
export function parseEntryFilters(raw: Raw | URLSearchParams): EntryFilters {
  const get = (key: string) =>
    raw instanceof URLSearchParams ? (raw.get(key) ?? undefined) : first(raw[key]);
  const book = get("kitob");
  const type = ENTRY_TYPES.find((item) => item === get("tur"));
  const color = get("rang");
  const q = get("q")?.trim();
  return {
    book: book && UUID_RE.test(book) ? book : undefined,
    type,
    // Rang faqat belgilash bilan ma'noli: boshqa tur tanlangan bo'lsa tashlanadi.
    color:
      color && COLOR_RE.test(color) && (type === undefined || type === "highlight")
        ? color.toLowerCase()
        : undefined,
    q: q ? q.slice(0, 100) : undefined,
  };
}

/** Filtr → URL query (bo'sh qiymatlar yo'q; tartib barqaror). */
export function entryQuery(filters: EntryFilters): string {
  const params = new URLSearchParams();
  if (filters.book) params.set("kitob", filters.book);
  if (filters.type) params.set("tur", filters.type);
  if (filters.color) params.set("rang", filters.color);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

/** Qidiruv 2 belgidan boshlab yuboriladi (bitta harfga hamma yozuv chiqmasin). */
export function effectiveQuery(q: string | undefined): string | undefined {
  const value = q?.trim();
  return value && value.length >= ENTRIES_QUERY_MIN ? value : undefined;
}

export function activeEntryFilterCount(filters: EntryFilters): number {
  return [filters.book, filters.type, filters.color, filters.q].filter(Boolean).length;
}

/** API so'rovi parametrlari. */
export function toEntriesApiParams(filters: EntryFilters, page: number) {
  return {
    book: filters.book,
    type: filters.type,
    color: filters.color,
    q: effectiveQuery(filters.q),
    page,
    page_size: ENTRIES_PAGE_SIZE,
  };
}

export const entryKey = (entry: Pick<PageEntry, "book" | "page">) =>
  `${entry.book.id}:${entry.page}`;

export interface BookGroup {
  book: PageEntry["book"];
  entries: PageEntry[];
}

/** Yozuvlarni kitob bo'yicha guruhlaydi (server kitob bo'yicha saralagan; sahifalar chegarasida ham birlashadi). */
export function groupEntriesByBook(entries: readonly PageEntry[]): BookGroup[] {
  const groups = new Map<string, BookGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.book.id);
    if (group) group.entries.push(entry);
    else groups.set(entry.book.id, { book: entry.book, entries: [entry] });
  }
  return [...groups.values()];
}

export interface EntrySummary {
  highlights: number;
  drawings: number;
  texts: number;
  solutions: number;
  hasNote: boolean;
  bookmarked: boolean;
  /** Belgilash ranglari (takrorsiz, birinchi uchragan tartibda). */
  colors: string[];
}

export function highlightColorOf(data: unknown): string | null {
  const color = (data as { color?: unknown } | null)?.color;
  return typeof color === "string" ? color : null;
}

export function summarizeEntry(entry: PageEntry): EntrySummary {
  const colors: string[] = [];
  let highlights = 0;
  let drawings = 0;
  let texts = 0;
  let solutions = 0;
  for (const item of entry.annotations) {
    if (item.type === "highlight") {
      highlights += 1;
      const color = highlightColorOf(item.data);
      if (color && !colors.includes(color)) colors.push(color);
    } else if (item.type === "drawing") drawings += 1;
    else if (item.type === "solution") solutions += 1;
    else texts += 1;
  }
  return {
    highlights,
    drawings,
    texts,
    solutions,
    hasNote: entry.note.trim() !== "",
    bookmarked: entry.bookmarked,
    colors,
  };
}

/** Yozuvda hech narsa qolmadimi (ro'yxatdan olib tashlanadi). */
export function isEntryEmpty(entry: PageEntry): boolean {
  return entry.annotations.length === 0 && entry.note.trim() === "" && !entry.bookmarked;
}

export interface EntrySolution {
  id: string;
  title: string;
  body: string;
}

/** Betdagi misol yechimlari (matematika kitob), yaratilish tartibida. */
export function solutionsOf(entry: PageEntry): EntrySolution[] {
  return parseAnnotations(entry.annotations).flatMap((item) =>
    item.type === "solution" ? [{ id: item.id, title: item.data.title, body: item.data.body }] : [],
  );
}

export const parsedAnnotations = (entry: PageEntry): Annotation[] =>
  parseAnnotations(entry.annotations);

/** Belgilash rangini almashtirib, yangi `data` qaytaradi. */
export function recolorHighlight(data: unknown, color: string): Record<string, unknown> {
  const base = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return { ...base, color };
}

/** Optimistik: belgilash rangi almashgan yozuv nusxasi. */
export function withHighlightColor(
  entry: PageEntry,
  annotationId: string,
  color: string,
): PageEntry {
  return {
    ...entry,
    annotations: entry.annotations.map((item) =>
      item.id === annotationId ? { ...item, data: recolorHighlight(item.data, color) } : item,
    ),
  };
}

export const withoutAnnotation = (entry: PageEntry, annotationId: string): PageEntry => ({
  ...entry,
  annotations: entry.annotations.filter((item) => item.id !== annotationId),
});
