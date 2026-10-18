import type { ReactNode } from "react";

export interface WidgetFrameProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

/** Interaktiv widget'lar uchun umumiy, minimal qobiq. */
export function WidgetFrame({ title, hint, children }: WidgetFrameProps) {
  return (
    <section className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:p-5 print:hidden">
      <header>
        <h3 className="text-lg font-semibold">{title}</h3>
        {hint && <p className="text-muted mt-1 text-sm">{hint}</p>}
      </header>
      {children}
    </section>
  );
}
