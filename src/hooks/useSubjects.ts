import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";

export function useSubjects() {
  return useQuery(apiQueries.subjects());
}
