import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hover/focus effekti — ichida havola yoki tugma bo'lgan kartalar uchun. */
  interactive?: boolean;
}

export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "border-border bg-surface rounded-xl border p-5 shadow-sm",
        interactive &&
          "focus-within:ring-ring/50 transition-shadow focus-within:ring-2 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-foreground text-base font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted mt-1 text-sm", className)} {...props} />;
}
