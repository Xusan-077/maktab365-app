import { queryOptions } from "@tanstack/react-query";
import { getAdminApi } from "./api";
import type { BookListParams, UserListParams } from "./types";

/** Admin so'rovlari bitta `admin` ildizi ostida: yozuvdan keyin hammasini bir chaqiruvda yangilash mumkin. */
export const ADMIN_ROOT_KEY = ["admin"] as const;

export const adminKeys = {
  dashboard: () => [...ADMIN_ROOT_KEY, "dashboard"] as const,
  stats: (days: number) => [...ADMIN_ROOT_KEY, "stats", days] as const,
  subjects: () => [...ADMIN_ROOT_KEY, "subjects"] as const,
  pdfBooks: (params: BookListParams) => [...ADMIN_ROOT_KEY, "pdf-books", params] as const,
  pdfBook: (id: string) => [...ADMIN_ROOT_KEY, "pdf-book", id] as const,
  users: (params: UserListParams) => [...ADMIN_ROOT_KEY, "users", params] as const,
};

export const adminQueries = {
  dashboard: () =>
    queryOptions({ queryKey: adminKeys.dashboard(), queryFn: () => getAdminApi().dashboard() }),
  stats: (days: 7 | 30) =>
    queryOptions({ queryKey: adminKeys.stats(days), queryFn: () => getAdminApi().stats(days) }),
  subjects: () =>
    queryOptions({
      queryKey: adminKeys.subjects(),
      queryFn: () => getAdminApi().subjects(),
      staleTime: 5 * 60_000,
    }),
  pdfBooks: (params: BookListParams) =>
    queryOptions({
      queryKey: adminKeys.pdfBooks(params),
      queryFn: () => getAdminApi().pdfBooks(params),
      placeholderData: (previous) => previous,
    }),
  pdfBook: (id: string) =>
    queryOptions({ queryKey: adminKeys.pdfBook(id), queryFn: () => getAdminApi().pdfBook(id) }),
  users: (params: UserListParams) =>
    queryOptions({
      queryKey: adminKeys.users(params),
      queryFn: () => getAdminApi().users(params),
      placeholderData: (previous) => previous,
    }),
};
