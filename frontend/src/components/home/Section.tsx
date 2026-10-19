import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface SectionProps {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bosh sahifa bo'limi: `id` + `aria-labelledby` bilan bog'langan h2. */
export function Section({ id, title, description, children, className }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16", className)}
    >
      <div className="mb-6 max-w-2xl sm:mb-8">
        <h2
          id={`${id}-title`}
          className="text-2xl font-bold tracking-tight text-balance sm:text-3xl"
        >
          {title}
        </h2>
        {description && <p className="text-muted mt-2 text-base">{description}</p>}
      </div>
      {children}
    </section>
  );
}
