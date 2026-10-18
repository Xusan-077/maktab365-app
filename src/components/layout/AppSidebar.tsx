"use client";

import { LifeBuoy, LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useAppBase } from "@/hooks/useAppBase";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { helpPath, ROUTES, type PanelBase } from "@/lib/utils/routes";
import { appNavFor } from "./app-nav";
import { Logo } from "./Logo";
import { Avatar } from "./UserMenu";

const linkClasses =
  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";
const idleClasses = "text-muted hover:bg-subtle hover:text-foreground";
const activeClasses = "bg-primary-soft text-primary-soft-foreground";

/** Desktopdagi chap sidebar: logo, rolga mos menyu, pastda yordam/sozlamalar/profil/chiqish. */
export function AppSidebar({ panel }: { panel: PanelBase }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const base = useAppBase();
  const { sessionUser } = useAuth();
  const { data: me } = useMe();
  const items = appNavFor(panel);
  const name = me?.name ?? sessionUser?.name ?? sessionUser?.email ?? "";

  const bottom = [
    { href: helpPath(panel), icon: LifeBuoy, label: t("panel.help") },
    { href: ROUTES.settings, icon: Settings, label: t("auth.settings") },
  ];

  return (
    <aside
      data-app-sidebar
      className="border-border bg-surface present:hidden sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-4 border-r px-3 py-4 max-lg:hidden print:hidden"
    >
      <div className="px-2 pt-1 pb-2">
        <Logo height={30} />
      </div>

      <nav aria-label={t("panel.nav.main")} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map(({ labelKey, href, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(linkClasses, active ? activeClasses : idleClasses)}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-border flex flex-col gap-1 border-t pt-3">
        {bottom.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(linkClasses, active ? activeClasses : idleClasses)}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
        <div className="mt-2 flex items-center gap-3 px-2">
          <Avatar name={name} image={sessionUser?.image} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-muted truncate text-xs">
              {base === "ustoz" ? t("panel.roleTeacher") : t("panel.roleStudent")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ redirectTo: `/${locale}` })}
          className={cn(linkClasses, idleClasses, "w-full text-left")}
        >
          <LogOut className="size-5 shrink-0" aria-hidden />
          {t("auth.signOut")}
        </button>
      </div>
    </aside>
  );
}
