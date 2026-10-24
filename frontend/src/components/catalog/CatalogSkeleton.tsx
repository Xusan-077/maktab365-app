import { BookCardSkeleton } from "@/components/site/BookCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

const GRID = "grid grid-cols-2 gap-x-5 gap-y-8 min-[560px]:grid-cols-3 xl:grid-cols-4";

/** Natijalar skeleton'i: sarlavha qatori + 12 ta karta (layout sakramaydi). */
export function CatalogResultsSkeleton() {
  return (
    <div aria-busy className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-11 w-52 rounded-xl" />
      </div>
      <div className={GRID}>
        {Array.from({ length: 12 }, (_, index) => (
          <BookCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/** Butun sahifa skeleton'i (params o'qilguncha). */
export function CatalogSkeleton() {
  return (
    <div className="max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-56" />
      </div>
      <div className="flex gap-10">
        <div className="hidden w-[16.25rem] shrink-0 flex-col gap-7 lg:flex" aria-hidden>
          <Skeleton className="h-12 rounded-[0.875rem]" />
          <Skeleton className="h-40" />
          <Skeleton className="h-44" />
        </div>
        <CatalogResultsSkeleton />
      </div>
    </div>
  );
}
