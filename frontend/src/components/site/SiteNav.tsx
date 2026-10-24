"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";

/** `key` — `nav.*` i18n kaliti. */
const ITEMS = [
  { key: "home", href: ROUTES.home },
  { key: "subjects", href: ROUTES.subjects },
  { key: "textbooks", href: ROUTES.textbooks },
] as const;

export interface SiteNavProps {
  orientation?: "horizontal" | "vertical";
  /** Havola bosilganda (mobil sheet'ni yopish uchun). */
  onNavigate?: () => void;
  className?: string;
}

export function SiteNav({ orientation = "horizontal", onNavigate, className }: SiteNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("main")} className={className}>
      <ul className={cn("flex gap-1", orientation === "vertical" && "flex-col")}>
        {ITEMS.map(({ key, href }) => {
          const active =
            href === ROUTES.home
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-[0.625rem] px-3.5 text-[0.9375rem] whitespace-nowrap transition-colors",
                  active
                    ? "bg-brand-soft text-brand-text font-semibold"
                    : "text-foreground hover:bg-surface-2 font-medium",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
