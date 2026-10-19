"use client";

import { useTranslations } from "next-intl";
import { useActiveSection } from "@/hooks/useActiveSection";
import { cn } from "@/lib/utils/cn";

export interface TocItem {
  id: string;
  label: string;
}

function TocLinks({ items, active }: { items: TocItem[]; active?: string }) {
  return (
    <ol className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            aria-current={item.id === active ? "location" : undefined}
            className={cn(
              "block rounded-md border-l-2 py-1.5 pr-2 pl-3 text-sm transition-colors",
              item.id === active
                ? "border-primary-600 text-foreground font-medium"
                : "text-muted hover:text-foreground border-transparent",
            )}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Desktopda sticky yon panel, mobilda yuqorida yig'iladigan `<details>`. Faol bo'lim scroll bo'yicha belgilanadi. */
export function TopicToc({ items }: { items: TocItem[] }) {
  const t = useTranslations("topic.toc");
  const active = useActiveSection(items.map((item) => item.id));

  return (
    <>
      <nav aria-label={t("label")} className="sticky top-24 hidden lg:block print:hidden">
        <p className="text-muted mb-2 px-3 text-xs font-semibold tracking-wide uppercase">
          {t("title")}
        </p>
        <TocLinks items={items} active={active} />
      </nav>
      <details className="border-border bg-surface rounded-xl border lg:hidden print:hidden">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {t("title")}
        </summary>
        <nav aria-label={t("label")} className="px-2 pb-3">
          <TocLinks items={items} active={active} />
        </nav>
      </details>
    </>
  );
}
