import { queryOptions } from "@tanstack/react-query";
import { getPdfBooksApi, type PdfBookFilters } from "./api";

/** Ochiq javoblar backend keshiga (`CONTENT_CACHE_MAX_AGE`, 60 s) mos: shuncha vaqt yangi hisoblanadi. */
const PUBLIC_STALE_MS = 60_000;

export const pdfKeys = {
  root: ["pdf-books"] as const,
  list: (filters: PdfBookFilters) => ["pdf-books", "list", filters] as const,
  subjects: (grade?: number) => ["pdf-books", "subjects", grade ?? null] as const,
  book: (id: string) => ["pdf-books", "book", id] as const,
  fileUrl: (id: string) => ["pdf-books", "file-url", id] as const,
  progress: (id: string) => ["pdf-progress", id] as const,
  allProgress: () => ["pdf-progress", "all"] as const,
};

export const pdfQueries = {
  list: (filters: PdfBookFilters) =>
    queryOptions({
      queryKey: pdfKeys.list(filters),
      queryFn: () => getPdfBooksApi().list(filters),
      staleTime: PUBLIC_STALE_MS,
      placeholderData: (previous) => previous,
    }),
  subjects: (grade?: number) =>
    queryOptions({
      queryKey: pdfKeys.subjects(grade),
      queryFn: () => getPdfBooksApi().subjects(grade),
      staleTime: PUBLIC_STALE_MS,
    }),
  book: (id: string) =>
    queryOptions({
      queryKey: pdfKeys.book(id),
      queryFn: () => getPdfBooksApi().book(id),
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
};
