import { LatestSkeleton } from "@/components/home/HomeSections";
import { Skeleton } from "@/components/ui/Skeleton";

/** Bosh sahifa skeleti: hero bloki va kitoblar to'ri (layout sakramaydi). */
export function HomeSkeleton() {
  return (
    <div aria-hidden>
      <section className="bg-hero-bg border-border border-b">
        <div className="max-w-site mx-auto flex flex-col gap-6 px-4 py-12 sm:px-8 sm:py-[4.5rem]">
          <Skeleton className="h-8 w-48 rounded-full" />
          <Skeleton className="h-24 w-full max-w-[38.75rem]" />
          <Skeleton className="h-14 w-full max-w-[32.5rem] rounded-2xl" />
        </div>
      </section>
      <div className="max-w-site mx-auto w-full px-4 pt-12 pb-20 sm:px-8 sm:pt-[4.5rem]">
        <LatestSkeleton />
      </div>
    </div>
  );
}
