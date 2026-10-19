import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  title: ReactNode;
  /** Bir-ikki gaplik izoh. */
  description?: ReactNode;
  /** Sahifaning yagona asosiy harakati (tugma yoki havola). */
  action?: ReactNode;
  className?: string;
}

/** Barcha sahifalar uchun yagona sarlavha: `h1`, qisqa izoh va ixtiyoriy asosiy harakat. */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
        {description && (
          <p className="text-muted text-base text-pretty sm:text-lg">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
