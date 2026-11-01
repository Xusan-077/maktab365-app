import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { retryUnlessClientError } from "@/lib/api/retry";
import { getBooksApi, getMyBooksApi } from "./api";
import { toEntriesApiParams, type EntryFilters } from "./entries";

export const bookKeys = {
  root: ["books"] as const,
  fileUrl: (id: string) => ["books", "file-url", id] as const,
  progress: (id: string) => ["books", "progress", id] as const,
  progressList: () => ["books", "progress", "all"] as const,
  bookmarks: (id: string) => ["books", "bookmarks", id] as const,
  note: (id: string, page: number) => ["books", "note", id, page] as const,
  annotations: (id: string, pages: readonly number[]) =>
    ["books", "annotations", id, pages.join(",")] as const,
  entriesRoot: () => ["books", "entries"] as const,
  entries: (filters: EntryFilters) => ["books", "entries", "list", filters] as const,
  entryBooks: () => ["books", "entries", "books"] as const,
  testSheet: (id: string) => ["books", "test", id, "sheet"] as const,
  testAttempts: (id: string) => ["books", "test", id, "attempts"] as const,
  testAttempt: (id: string, attemptId: string) =>
    ["books", "test", id, "attempt", attemptId] as const,
};

export const bookQueries = {
  /** Imzolangan URL: har ochilishda yangi olinadi, keshlanmaydi. */
  fileUrl: (id: string) =>
    queryOptions({
      queryKey: bookKeys.fileUrl(id),
      queryFn: () => getBooksApi().fileUrl(id),
      staleTime: 0,
      gcTime: 0,
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
  testSheet: (id: string) =>
    queryOptions({
      queryKey: bookKeys.testSheet(id),
      queryFn: () => getMyBooksApi().testSheet(id),
      retry: retryUnlessClientError,
      staleTime: 60_000,
    }),
  testAttempts: (id: string) =>
    queryOptions({
      queryKey: bookKeys.testAttempts(id),
      queryFn: () => getMyBooksApi().testAttempts(id),
      retry: retryUnlessClientError,
    }),
  testAttempt: (id: string, attemptId: string) =>
    queryOptions({
      queryKey: bookKeys.testAttempt(id, attemptId),
      queryFn: () => getMyBooksApi().testAttempt(id, attemptId),
      retry: retryUnlessClientError,
      staleTime: Infinity,
    }),
};
