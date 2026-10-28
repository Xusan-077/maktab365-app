import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/types";
import { getGamesApi, type GameTopic } from "./api";
import type { GameFilters } from "./filters";

export const gameKeys = {
  root: ["games"] as const,
  topics: (filters: GameFilters) => ["games", "topics", filters] as const,
  topic: (slug: string) => ["games", "topic", slug] as const,
  allowance: () => ["games", "allowance"] as const,
};

export const gameQueries = {
  topics: (filters: GameFilters) =>
    infiniteQueryOptions({
      queryKey: gameKeys.topics(filters),
      queryFn: ({ pageParam }) => getGamesApi().topics(filters, pageParam),
      initialPageParam: 1,
      getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
      staleTime: 60_000,
      placeholderData: (previous) => previous,
    }),
  /** Mavzu sahifasidagi blok uchun: o'ynab bo'lmaydigan (savoli kam) mavzu — `null` (404). */
  topic: (slug: string) =>
    queryOptions({
      queryKey: gameKeys.topic(slug),
      queryFn: async (): Promise<GameTopic | null> => {
        try {
          return await getGamesApi().topic(slug);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }
      },
      staleTime: 5 * 60_000,
    }),
  allowance: () =>
    queryOptions({
      queryKey: gameKeys.allowance(),
      queryFn: () => getGamesApi().allowance(),
      staleTime: 30_000,
    }),
};
