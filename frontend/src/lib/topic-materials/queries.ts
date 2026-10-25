import { queryOptions } from "@tanstack/react-query";
import { getTopicMaterialsApi } from "./api";

export const topicKeys = {
  root: ["topic-materials"] as const,
  summary: (topicId: string) => ["topic-materials", topicId, "summary"] as const,
  presentation: (topicId: string) => ["topic-materials", topicId, "presentation"] as const,
};

/** Konvertatsiya holati shuncha ms da qayta so'raladi (admin yuklagandan keyin, `processing` paytida). */
export const CONVERSION_POLL_MS = 2000;

export const topicQueries = {
  summary: (topicId: string) =>
    queryOptions({
      queryKey: topicKeys.summary(topicId),
      queryFn: () => getTopicMaterialsApi().summary(topicId),
      staleTime: 60_000,
    }),
  presentation: (topicId: string) =>
    queryOptions({
      queryKey: topicKeys.presentation(topicId),
      queryFn: () => getTopicMaterialsApi().presentation(topicId),
      staleTime: 60_000,
    }),
};
