import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";

export function useTopic(topicId: string) {
  return useQuery(apiQueries.topic(topicId));
}
