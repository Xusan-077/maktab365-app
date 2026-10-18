import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "neutral" | "primary" | "accent" | "success" | "danger";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-subtle text-foreground",
  primary: "bg-primary-soft text-primary-soft-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
