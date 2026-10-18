import type { ReactNode } from "react";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary, type QueryClient } from "@tanstack/react-query";
import { getServerQueryClient } from "@/lib/api/server-query-client";

/**
 * Server komponentda prefetch + hydrate. TanStack Query holat vaqtini `Date.now()` bilan yozadi,
 * Cache Components esa buni prerender'da qabul qilmaydi, shuning uchun prefetch so'rov vaqtida
 * bajariladi: komponentni `<Suspense>` ichiga qo'ying.
 *
 * `<HydrateQueries prefetch={(qc) => qc.prefetchQuery(apiQueries.books({ grade: 9 }))}>…</HydrateQueries>`
 */
export async function HydrateQueries({
  prefetch,
  children,
}: {
  prefetch: (queryClient: QueryClient) => Promise<unknown>;
  children: ReactNode;
}) {
  await connection();
  const queryClient = getServerQueryClient();
  await prefetch(queryClient);
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
