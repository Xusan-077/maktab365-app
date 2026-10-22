import { queryOptions } from "@tanstack/react-query";
import { getAdminApi } from "./api";
import type { BookListParams } from "./types";

/** Admin so'rovlari bitta `admin` ildizi ostida: yozuvdan keyin hammasini bir chaqiruvda yangilash mumkin. */
export const ADMIN_ROOT_KEY = ["admin"] as const;

export const adminKeys = {
  dashboard: () => [...ADMIN_ROOT_KEY, "dashboard"] as const,
  subjects: () => [...ADMIN_ROOT_KEY, "subjects"] as const,
  books: (params: BookListParams) => [...ADMIN_ROOT_KEY, "books", params] as const,
  book: (id: string) => [...ADMIN_ROOT_KEY, "book", id] as const,
  pdfBooks: (params: BookListParams) => [...ADMIN_ROOT_KEY, "pdf-books", params] as const,
  pdfBook: (id: string) => [...ADMIN_ROOT_KEY, "pdf-book", id] as const,
  tree: (bookId: string) => [...ADMIN_ROOT_KEY, "tree", bookId] as const,
  topic: (id: string) => [...ADMIN_ROOT_KEY, "topic", id] as const,
  users: (params: { page?: number; search?: string }) =>
    [...ADMIN_ROOT_KEY, "users", params] as const,
};

export const adminQueries = {
  dashboard: () =>
    queryOptions({ queryKey: adminKeys.dashboard(), queryFn: () => getAdminApi().dashboard() }),
  subjects: () =>
    queryOptions({
      queryKey: adminKeys.subjects(),
      queryFn: () => getAdminApi().subjects(),
      staleTime: 5 * 60_000,
    }),
  books: (params: BookListParams) =>
    queryOptions({
      queryKey: adminKeys.books(params),
      queryFn: () => getAdminApi().books(params),
      placeholderData: (previous) => previous,
    }),
  book: (id: string) =>
    queryOptions({ queryKey: adminKeys.book(id), queryFn: () => getAdminApi().book(id) }),
  pdfBooks: (params: BookListParams) =>
    queryOptions({
      queryKey: adminKeys.pdfBooks(params),
      queryFn: () => getAdminApi().pdfBooks(params),
      placeholderData: (previous) => previous,
    }),
  pdfBook: (id: string) =>
    queryOptions({ queryKey: adminKeys.pdfBook(id), queryFn: () => getAdminApi().pdfBook(id) }),
  /** Kitob daraxti: boblar va mavzular birga. */
  tree: (bookId: string) =>
    queryOptions({
      queryKey: adminKeys.tree(bookId),
      queryFn: async () => {
        const api = getAdminApi();
        const [chapters, topics] = await Promise.all([api.chapters(bookId), api.topics(bookId)]);
        return { chapters, topics };
      },
    }),
  topic: (id: string) =>
    queryOptions({ queryKey: adminKeys.topic(id), queryFn: () => getAdminApi().topic(id) }),
  users: (params: { page?: number; search?: string }) =>
    queryOptions({
      queryKey: adminKeys.users(params),
      queryFn: () => getAdminApi().users(params),
      placeholderData: (previous) => previous,
    }),
};
