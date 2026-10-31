import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/lib/api/retry";
import { getBooksApi, getMyBooksApi } from "./api";
import { toEntriesApiParams, type EntryFilters } from "./entries";

/** Qidiruv so'rovi shuncha belgidan boshlanadi (backend bilan bir xil). */
export const BOOK_SEARCH_MIN_LENGTH = 2;

/** Ochiq javoblar backend keshiga mos: shuncha vaqt yangi hisoblanadi. */
const PUBLIC_STALE_MS = 60_000;

export const bookKeys = {
  root: ["books"] as const,
  pageText: (id: string, page: number) => ["books", "page-text", id, page] as const,
  search: (id: string, q: string) => ["books", "search", id, q] as const,
  progress: (id: string) => ["books", "progress", id] as const,
  progressList: () => ["books", "progress", "all"] as const,
  bookmarks: (id: string) => ["books", "bookmarks", id] as const,
  note: (id: string, page: number) => ["books", "note", id, page] as const,
  annotations: (id: string, pages: readonly number[]) =>
    ["books", "annotations", id, pages.join(",")] as const,
  entriesRoot: () => ["books", "entries"] as const,
  entries: (filters: EntryFilters) => ["books", "entries", "list", filters] as const,
  entryBooks: () => ["books", "entries", "books"] as const,
};

export const bookQueries = {
  pageText: (id: string, page: number) =>
    queryOptions({
      queryKey: bookKeys.pageText(id, page),
      queryFn: () => getBooksApi().pageText(id, page),
      staleTime: PUBLIC_STALE_MS * 5,
      retry: retryUnlessClientError,
    }),
  search: (id: string, q: string) =>
    queryOptions({
      queryKey: bookKeys.search(id, q),
      queryFn: () => getBooksApi().search(id, q),
      staleTime: PUBLIC_STALE_MS,
      retry: retryUnlessClientError,
    }),
  progress: (id: string) =>
    queryOptions({
      queryKey: bookKeys.progress(id),
      queryFn: () => getMyBooksApi().progress(id),
      retry: retryUnlessClientError,
    }),
  progressList: () =>
    queryOptions({
      queryKey: bookKeys.progressList(),
      queryFn: () => getMyBooksApi().progressList(),
      retry: retryUnlessClientError,
    }),
  bookmarks: (id: string) =>
    queryOptions({
      queryKey: bookKeys.bookmarks(id),
      queryFn: () => getMyBooksApi().bookmarks(id),
      retry: retryUnlessClientError,
    }),
  note: (id: string, page: number) =>
    queryOptions({
      queryKey: bookKeys.note(id, page),
      queryFn: () => getMyBooksApi().note(id, page),
      retry: retryUnlessClientError,
    }),
  annotations: (id: string, pages: readonly number[]) =>
    queryOptions({
      queryKey: bookKeys.annotations(id, pages),
      queryFn: () => getMyBooksApi().annotations(id, pages),
      retry: retryUnlessClientError,
      // Server nusxasi faqat bir marta storega o'tadi; keyin store (mahalliy tarix) manba.
      staleTime: Infinity,
      gcTime: 60_000,
    }),
  entries: (filters: EntryFilters) =>
    infiniteQueryOptions({
      queryKey: bookKeys.entries(filters),
      queryFn: ({ pageParam }) => getMyBooksApi().entries(toEntriesApiParams(filters, pageParam)),
      initialPageParam: 1,
      getNextPageParam: (last) =>
        last.page * last.page_size < last.count ? last.page + 1 : undefined,
      retry: retryUnlessClientError,
      staleTime: 30_000,
    }),
  entryBooks: () =>
    queryOptions({
      queryKey: bookKeys.entryBooks(),
      queryFn: () => getMyBooksApi().entryBooks(),
      retry: retryUnlessClientError,
      staleTime: 30_000,
    }),
};
