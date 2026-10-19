"use client";

import { Link, usePathname } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-items";

export function MainNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("main")} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ key, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary-soft-foreground"
                    : "text-muted hover:bg-subtle hover:text-foreground",
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
