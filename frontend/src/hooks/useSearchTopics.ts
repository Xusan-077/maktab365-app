import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import type { TopicSearchFilters } from "@/types/topic";

/** Qidiruv matni SEARCH_MIN_LENGTH dan qisqa bo'lsa so'rov yuborilmaydi. */
export function useSearchTopics(query: string, filters?: TopicSearchFilters) {
  return useQuery(apiQueries.search(query.trim(), filters));
}
