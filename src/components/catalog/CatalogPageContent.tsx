import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getRootCrumb, pageShellClass } from "@/components/layout/crumbs";
import { HydrateQueries } from "@/components/layout/HydrateQueries";
import { apiQueries, SEARCH_MIN_LENGTH } from "@/lib/api/queries";
import { parseCatalogParams, toBookFilters } from "@/lib/utils/catalog-params";
import type { AppBase } from "@/lib/utils/routes";
import { cn } from "@/lib/utils/cn";
import { CatalogSkeleton, CatalogView } from "./CatalogView";

/** Filtrlar `searchParams`dan o'qiladi (so'rov vaqtida), shuning uchun alohida Suspense ichida. */
async function CatalogContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial = parseCatalogParams((name) => {
    const value = params[name];
    return Array.isArray(value) ? value[0] : value;
  });

  return (
    <HydrateQueries
      prefetch={(queryClient) =>
        Promise.all([
          queryClient.prefetchQuery(apiQueries.grades()),
          queryClient.prefetchQuery(apiQueries.subjects()),
          queryClient.prefetchQuery(apiQueries.books(toBookFilters(initial))),
          initial.q && initial.q.length >= SEARCH_MIN_LENGTH
            ? queryClient.prefetchQuery(apiQueries.search(initial.q, {}))
            : undefined,
        ])
      }
    >
      <CatalogView initial={initial} />
    </HydrateQueries>
  );
}

/** Darsliklar katalogi: marketing `/darsliklar` va kabinet `/kabinet/darsliklar` uchun umumiy. */
export async function CatalogPageContent({
  base,
  searchParams,
}: {
  base: AppBase;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("catalog");
  const root = base === "marketing" ? await getRootCrumb(base) : null;

  return (
    <div className={cn("flex flex-col gap-6", pageShellClass(base))}>
      {root && <Breadcrumbs items={[root, { label: t("title") }]} />}
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted mt-1 text-lg">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
