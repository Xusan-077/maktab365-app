import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn("bg-subtle animate-pulse rounded-md", className)} {...props} />
  );
}
