import { Skeleton } from "@/components/ui/Skeleton";

/** `/fanlar` yuklanish holati: sarlavha, qidiruv, tablar va ikki guruh kartalari (layout sakramaydi). */
export function SubjectsSkeleton() {
  return (
    <div
      aria-busy
      className="max-w-site mx-auto flex w-full flex-col gap-10 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24"
    >
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-6 w-full max-w-md" />
      </div>
      <Skeleton className="h-12 w-full rounded-[0.875rem] sm:w-[21.25rem]" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 2 }, (_, group) => (
        <div key={group} className="flex flex-col gap-4">
          <Skeleton className="h-7 w-52" />
          <div className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))]">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[5.125rem] rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
