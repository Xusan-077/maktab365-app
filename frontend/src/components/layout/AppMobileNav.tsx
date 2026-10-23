"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { PanelBase } from "@/lib/utils/routes";
import { appNavFor } from "./app-nav";

/** lg dan kichik ekranlarda panelning pastki tab bar'i (menyu bandlari sidebar bilan bir xil). */
export function AppMobileNav({ panel }: { panel: PanelBase }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("panel.nav.mobile")}
      className="border-border bg-surface present:hidden fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
    >
      {appNavFor(panel).map(({ labelKey, href, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[0.6875rem] font-medium transition-colors",
              active ? "text-link" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
