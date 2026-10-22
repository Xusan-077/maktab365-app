"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, LogOut, Search } from "lucide-react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar } from "@/components/layout/UserMenu";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";
import { useAdminIdentity } from "./AdminRoleProvider";
import { adminNavFor } from "./admin-nav";

const linkClasses =
  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";
const idleClasses = "text-muted hover:bg-subtle hover:text-foreground";
const activeClasses = "bg-primary-soft text-primary-soft-foreground";

function AdminSidebar() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pathname = usePathname();
  const { role, email } = useAdminIdentity();

  return (
    <aside
      data-admin-sidebar
      className="border-border bg-surface sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-4 border-r px-3 py-4 max-lg:hidden print:hidden"
    >
      <div className="flex flex-col gap-1 px-2 pt-1 pb-2">
        <Logo height={30} href={ADMIN_ROUTES.home} />
        <span className="text-muted text-xs font-medium tracking-wide uppercase">{t("brand")}</span>
      </div>

      <nav aria-label={t("nav.main")} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {adminNavFor(role).map(({ key, href, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(linkClasses, active ? activeClasses : idleClasses)}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="border-border flex flex-col gap-1 border-t pt-3">
        <Link href={ROUTES.home} className={cn(linkClasses, idleClasses)}>
          <ExternalLink className="size-5 shrink-0" aria-hidden />
          {t("nav.site")}
        </Link>
        <div className="mt-2 flex items-center gap-3 px-2">
          <Avatar name={email ?? ""} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{email}</p>
            <p className="text-muted truncate text-xs">{t(`roles.${role}`)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ redirectTo: `/${locale}` })}
          className={cn(linkClasses, idleClasses, "w-full text-left")}
        >
          <LogOut className="size-5 shrink-0" aria-hidden />
          {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );
}

function AdminSearch() {
  const t = useTranslations("admin.topbar");
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(
      q ? `${ADMIN_ROUTES.pdfBooks}?${new URLSearchParams({ q })}` : ADMIN_ROUTES.pdfBooks,
    );
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-sm">
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-10 w-full rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors"
      />
    </form>
  );
}

function AdminTopbar() {
  return (
    <header
      data-admin-topbar
      className="border-border bg-background/85 sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 backdrop-blur sm:px-6 print:hidden"
    >
      <Logo variant="mark" height={22} href={ADMIN_ROUTES.home} className="lg:hidden" />
      <AdminSearch />
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher className="hidden sm:inline-flex" />
        <ThemeToggle />
      </div>
    </header>
  );
}

function AdminMobileNav() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const { role } = useAdminIdentity();

  return (
    <nav
      aria-label={t("mobile")}
      className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden print:hidden"
    >
      {adminNavFor(role).map(({ key, href, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[0.6875rem] font-medium transition-colors",
              active ? "text-link" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Admin qobig'i: chap sidebar (logo, bo'limlar, pastda profil/chiqish) va topbar (qidiruv, til, theme).
 * Marketing header/footer va o'quvchi/o'qituvchi paneli elementlari bu yerda yo'q.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div data-layout="admin" className="flex min-h-dvh">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex w-full flex-1 flex-col gap-8 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] focus:outline-none sm:px-6 lg:py-8 lg:pb-8"
        >
          {children}
        </main>
      </div>
      <AdminMobileNav />
    </div>
  );
}
