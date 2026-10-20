import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Forma ustidagi xabar (xato yoki muvaffaqiyat); ekran o'qigich darhol o'qiydi. */
export function FormAlert({
  variant = "error",
  children,
  className,
}: {
  variant?: "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const Icon = variant === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "border-border bg-surface flex items-start gap-3 rounded-lg border p-3 text-sm",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          variant === "error" ? "text-danger" : "text-success",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
