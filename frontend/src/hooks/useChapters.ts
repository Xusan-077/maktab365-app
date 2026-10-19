import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";

export function useChapters(bookId: string) {
  return useQuery(apiQueries.chapters(bookId));
}
