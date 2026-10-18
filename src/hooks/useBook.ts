import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";

export function useBook(bookId: string) {
  return useQuery(apiQueries.book(bookId));
}
