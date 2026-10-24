import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** Admin ro'yxatlari uchun oddiy tanlash katagi (`aria-label` majburiy). */
export function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "aria-label"> & { "aria-label": string }) {
  return (
    <input
      type="checkbox"
      className={cn("accent-primary-600 size-4 cursor-pointer rounded", className)}
      {...props}
    />
  );
}
