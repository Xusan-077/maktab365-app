import { queryOptions } from "@tanstack/react-query";
import { getPdfBooksApi, type PdfBookFilters } from "./api";

/** Qidiruv so'rovi shuncha belgidan boshlanadi. */
export const SEARCH_MIN_LENGTH = 2;

/** Ochiq javoblar backend keshiga (`CONTENT_CACHE_MAX_AGE`, 60 s) mos: shuncha vaqt yangi hisoblanadi. */
const PUBLIC_STALE_MS = 60_000;

export const pdfKeys = {
  root: ["pdf-books"] as const,
  list: (filters: PdfBookFilters) => ["pdf-books", "list", filters] as const,
  subjects: (grade?: number, includeEmpty = false) =>
    ["pdf-books", "subjects", grade ?? null, includeEmpty] as const,
  book: (id: string) => ["pdf-books", "book", id] as const,
  bookBySlug: (slug: string) => ["pdf-books", "book-by-slug", slug] as const,
  chapterSearch: (q: string) => ["pdf-books", "chapter-search", q] as const,
  fileUrl: (id: string) => ["pdf-books", "file-url", id] as const,
  slidesUrl: (bookId: string, chapterId: string) =>
    ["pdf-books", "slides-url", bookId, chapterId] as const,
  progress: (id: string) => ["pdf-progress", id] as const,
  allProgress: () => ["pdf-progress", "all"] as const,
  library: () => ["pdf-library"] as const,
  dashboard: () => ["pdf-dashboard"] as const,
  teacherDashboard: () => ["pdf-dashboard", "teacher"] as const,
  results: () => ["pdf-results"] as const,
  goals: () => ["pdf-goals"] as const,
  bookmarks: () => ["pdf-bookmarks"] as const,
};

export const pdfQueries = {
  list: (filters: PdfBookFilters) =>
    queryOptions({
      queryKey: pdfKeys.list(filters),
      queryFn: () => getPdfBooksApi().list(filters),
      staleTime: PUBLIC_STALE_MS,
      placeholderData: (previous) => previous,
    }),
  subjects: (grade?: number, includeEmpty = false) =>
    queryOptions({
      queryKey: pdfKeys.subjects(grade, includeEmpty),
      queryFn: () => getPdfBooksApi().subjects(grade, includeEmpty),
      staleTime: PUBLIC_STALE_MS,
    }),
  book: (id: string) =>
    queryOptions({
      queryKey: pdfKeys.book(id),
      queryFn: () => getPdfBooksApi().book(id),
      staleTime: PUBLIC_STALE_MS,
    }),
  chapterSearch: (q: string) =>
    queryOptions({
      queryKey: pdfKeys.chapterSearch(q),
      queryFn: () => getPdfBooksApi().searchChapters(q),
      staleTime: PUBLIC_STALE_MS,
    }),
  /** Slug bo'yicha (qoralamani staff ko'ra olishi uchun mijozda, BFF orqali). */
  bookBySlug: (slug: string) =>
    queryOptions({
      queryKey: pdfKeys.bookBySlug(slug),
      queryFn: () => getPdfBooksApi().bookBySlug(slug),
      staleTime: PUBLIC_STALE_MS,
    }),
  /** Imzolangan URL: har ochilishda yangi olinadi, keshlanmaydi. */
  fileUrl: (id: string) =>
    queryOptions({
      queryKey: pdfKeys.fileUrl(id),
      queryFn: () => getPdfBooksApi().fileUrl(id),
      staleTime: 0,
      gcTime: 0,
    }),
  /** Prezentatsiya uchun imzolangan URL: har ochilishda yangi olinadi. */
  slidesUrl: (bookId: string, chapterId: string) =>
    queryOptions({
      queryKey: pdfKeys.slidesUrl(bookId, chapterId),
      queryFn: () => getPdfBooksApi().slidesUrl(bookId, chapterId),
      staleTime: 0,
      gcTime: 0,
    }),
  progress: (id: string) =>
    queryOptions({
      queryKey: pdfKeys.progress(id),
      queryFn: () => getPdfBooksApi().myProgress(id),
    }),
  allProgress: () =>
    queryOptions({
      queryKey: pdfKeys.allProgress(),
      queryFn: () => getPdfBooksApi().allProgress(),
    }),
  library: () =>
    queryOptions({ queryKey: pdfKeys.library(), queryFn: () => getPdfBooksApi().library() }),
  bookmarks: () =>
    queryOptions({ queryKey: pdfKeys.bookmarks(), queryFn: () => getPdfBooksApi().bookmarks() }),
  dashboard: () =>
    queryOptions({ queryKey: pdfKeys.dashboard(), queryFn: () => getPdfBooksApi().dashboard() }),
  teacherDashboard: () =>
    queryOptions({
      queryKey: pdfKeys.teacherDashboard(),
      queryFn: () => getPdfBooksApi().teacherDashboard(),
    }),
  results: () =>
    queryOptions({ queryKey: pdfKeys.results(), queryFn: () => getPdfBooksApi().results() }),
  goals: () => queryOptions({ queryKey: pdfKeys.goals(), queryFn: () => getPdfBooksApi().goals() }),
};
