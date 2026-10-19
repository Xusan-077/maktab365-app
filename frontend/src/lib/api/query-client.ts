import { QueryClient } from "@tanstack/react-query";

/** Server prefetch qilgan ma'lumot mijozda darrov qayta so'ralmasligi uchun staleTime > 0. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
  });
}
