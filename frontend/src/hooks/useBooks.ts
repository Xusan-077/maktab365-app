import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import type { BookFilters } from "@/types/catalog";

export function useBooks(filters?: BookFilters) {
  return useQuery(apiQueries.books(filters));
}
