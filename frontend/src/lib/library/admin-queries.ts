import { queryOptions } from "@tanstack/react-query";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import { getAdminLibraryApi, type LibraryListParams } from "./admin-api";

/** `ADMIN_ROOT_KEY` ostida: admin yozuvlaridan keyingi umumiy yangilash bularni ham qamraydi. */
export const libraryKeys = {
  root: [...ADMIN_ROOT_KEY, "library"] as const,
  list: (params: LibraryListParams) => [...ADMIN_ROOT_KEY, "library", "list", params] as const,
  book: (id: string) => [...ADMIN_ROOT_KEY, "library", "book", id] as const,
  types: [...ADMIN_ROOT_KEY, "library", "types"] as const,
  answerKey: (id: string) => [...ADMIN_ROOT_KEY, "library", "answer-key", id] as const,
};

export const libraryQueries = {
  list: (params: LibraryListParams) =>
    queryOptions({
      queryKey: libraryKeys.list(params),
      queryFn: () => getAdminLibraryApi().list(params),
      placeholderData: (previous) => previous,
    }),
  types: () =>
    queryOptions({
      queryKey: libraryKeys.types,
      queryFn: () => getAdminLibraryApi().types(),
    }),
  book: (id: string) =>
    queryOptions({
      queryKey: libraryKeys.book(id),
      queryFn: () => getAdminLibraryApi().get(id),
    }),
  answerKey: (id: string) =>
    queryOptions({
      queryKey: libraryKeys.answerKey(id),
      queryFn: () => getAdminLibraryApi().answerKey(id),
    }),
};
