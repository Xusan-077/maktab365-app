import { queryOptions } from "@tanstack/react-query";
import { getAdminApi } from "./api";
import type { BookListParams, SupportListParams, UserListParams } from "./types";

/** Sidebar'dagi yangi xabarlar soni shu oraliqda yangilanadi. */
const SUMMARY_REFRESH_MS = 60_000;

/** Admin so'rovlari bitta `admin` ildizi ostida: yozuvdan keyin hammasini bir chaqiruvda yangilash mumkin. */
export const ADMIN_ROOT_KEY = ["admin"] as const;

export const adminKeys = {
  dashboard: () => [...ADMIN_ROOT_KEY, "dashboard"] as const,
  stats: (days: number) => [...ADMIN_ROOT_KEY, "stats", days] as const,
  subjects: () => [...ADMIN_ROOT_KEY, "subjects"] as const,
  pdfBooks: (params: BookListParams) => [...ADMIN_ROOT_KEY, "pdf-books", params] as const,
  support: (params: SupportListParams) => [...ADMIN_ROOT_KEY, "support", params] as const,
  supportSummary: () => [...ADMIN_ROOT_KEY, "support", "summary"] as const,
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
  support: (params: SupportListParams) =>
    queryOptions({
      queryKey: adminKeys.support(params),
      queryFn: () => getAdminApi().supportMessages(params),
      placeholderData: (previous) => previous,
    }),
  supportSummary: () =>
    queryOptions({
      queryKey: adminKeys.supportSummary(),
      queryFn: () => getAdminApi().supportSummary(),
      refetchInterval: SUMMARY_REFRESH_MS,
    }),
  users: (params: UserListParams) =>
    queryOptions({
      queryKey: adminKeys.users(params),
      queryFn: () => getAdminApi().users(params),
      placeholderData: (previous) => previous,
    }),
};
