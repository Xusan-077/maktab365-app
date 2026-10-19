import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  icon: LucideIcon;
  /** Bitta gap: nima yo'q va nima qilish mumkin. */
  children: ReactNode;
  /** Bitta tugma yoki havola. */
  action?: ReactNode;
  className?: string;
}

/** Bo'sh ro'yxat holati: ikonka, bitta gap, bitta harakat. */
export function EmptyState({ icon: Icon, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-subtle/50 flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center",
        className,
      )}
    >
      <span className="bg-primary-soft text-link flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-muted max-w-sm text-sm text-pretty">{children}</p>
      {action}
    </div>
  );
}
