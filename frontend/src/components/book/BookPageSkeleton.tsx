import { Skeleton } from "@/components/ui/Skeleton";

/** Kitob sahifasi skeleti: hero (muqova + sarlavha + faktlar + tugmalar) va mundarija; layout sakramaydi. */
export function BookPageSkeleton() {
  return (
    <div aria-hidden>
      <section className="bg-hero-bg border-border border-b">
        <div className="max-w-site mx-auto flex flex-col gap-7 px-4 pt-8 pb-12 sm:px-8 sm:pb-14">
          <Skeleton className="h-4 w-56" />
          <div className="flex flex-wrap items-start gap-8 sm:gap-14">
            <Skeleton className="rounded-cover aspect-[3/4] w-40 sm:w-80" />
            <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-5">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-14 w-72 max-w-full" />
              <Skeleton className="h-28 w-full max-w-[38.75rem] rounded-2xl" />
              <Skeleton className="h-14 w-full max-w-[38.75rem] rounded-2xl" />
            </div>
          </div>
        </div>
      </section>
      <div className="max-w-site mx-auto flex flex-col gap-4 px-4 pt-14 pb-24 sm:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-[1.125rem]" />
      </div>
    </div>
  );
}
