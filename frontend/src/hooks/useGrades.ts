import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";

export function useGrades() {
  return useQuery(apiQueries.grades());
}
