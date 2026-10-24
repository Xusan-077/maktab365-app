import { Skeleton } from "@/components/ui/Skeleton";

/** `BookCard` shaklidagi skeleton: 3:4 muqova + ikki qator matn (layout sakramaydi). */
export function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="rounded-cover aspect-[3/4] w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}
