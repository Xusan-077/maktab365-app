import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800",
  secondary: "border border-border bg-surface text-foreground shadow-xs hover:bg-subtle",
  ghost: "text-foreground hover:bg-subtle",
  accent: "bg-accent text-on-accent shadow-xs hover:bg-accent-200",
  danger: "bg-red-600 text-white shadow-xs hover:bg-red-700",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "size-10",
};

/** Havola (`<Link>`) ni tugma ko'rinishida chizish uchun ham ishlatiladi. */
export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
