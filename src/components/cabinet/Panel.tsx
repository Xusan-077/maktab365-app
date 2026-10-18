import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface PanelProps {
  title: string;
  /** Sarlavha yonidagi qisqa izoh (masalan, davr). */
  note?: string;
  /** Pastdagi "hammasi" kabi havola. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Kabinet blokining oddiy qobig'i: sarlavhali, chegarali, bezaksiz. */
export function Panel({ title, note, footer, className, children }: PanelProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "border-border bg-surface flex flex-col gap-4 rounded-xl border p-5",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {note && <p className="text-muted text-sm">{note}</p>}
      </header>
      {children}
      {footer && <footer className="text-sm">{footer}</footer>}
    </section>
  );
}

/** Bo'sh holat matni: nima yo'qligi va keyingi qadam. */
export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-muted text-sm leading-relaxed">{children}</p>;
}
