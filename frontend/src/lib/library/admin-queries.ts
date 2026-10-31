import { queryOptions } from "@tanstack/react-query";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import { getAdminLibraryApi, type AdminBook, type LibraryListParams } from "./admin-api";

/** Sahifalar tayyorlanayotganda holat shu oraliqda qayta so'raladi. */
export const PROCESSING_POLL_MS = 3000;

/** `ADMIN_ROOT_KEY` ostida: admin yozuvlaridan keyingi umumiy yangilash bularni ham qamraydi. */
export const libraryKeys = {
  root: [...ADMIN_ROOT_KEY, "library"] as const,
  list: (params: LibraryListParams) => [...ADMIN_ROOT_KEY, "library", "list", params] as const,
  book: (id: string) => [...ADMIN_ROOT_KEY, "library", "book", id] as const,
};

export const isProcessing = (book: AdminBook | undefined) => book?.status === "processing";

export const libraryQueries = {
  list: (params: LibraryListParams) =>
    queryOptions({
      queryKey: libraryKeys.list(params),
      queryFn: () => getAdminLibraryApi().list(params),
      placeholderData: (previous) => previous,
      refetchInterval: (query) =>
        query.state.data?.results.some(isProcessing) ? PROCESSING_POLL_MS : false,
    }),
  book: (id: string) =>
    queryOptions({
      queryKey: libraryKeys.book(id),
      queryFn: () => getAdminLibraryApi().get(id),
      refetchInterval: (query) => (isProcessing(query.state.data) ? PROCESSING_POLL_MS : false),
    }),
};
