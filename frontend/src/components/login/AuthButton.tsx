import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AuthButtonVariant = "brand" | "soft" | "white" | "telegram";

const variants: Record<AuthButtonVariant, string> = {
  brand:
    "bg-brand text-white hover:bg-brand-hover disabled:bg-[#c9d6f3] dark:disabled:bg-brand-ring",
  soft: "bg-brand-soft text-brand-text hover:bg-brand-ring",
  white:
    "border-[1.5px] border-auth-field bg-auth-panel text-auth-text hover:border-brand hover:bg-auth-surface-2",
  // Mobilda ko'k (bosh barmoq zonasida), desktopda Google bilan bir xil oq.
  telegram:
    "bg-[#229ed9] text-white hover:bg-[#1b8cc2] lg:border-[1.5px] lg:border-auth-field lg:bg-auth-panel lg:text-auth-text lg:hover:border-brand lg:hover:bg-auth-surface-2",
};

/** Kirish sahifasi tugmasi: 52px (mobilda 54px), radius 14px, yuklanish holati bilan. */
export function AuthButton({
  variant = "brand",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: AuthButtonVariant; loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "focus-visible:ring-brand-ring inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] px-5 text-base font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-4 lg:h-[52px]",
        "disabled:cursor-not-allowed disabled:opacity-100",
        variants[variant],
        (disabled || loading) && variant !== "brand" && "opacity-70",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
