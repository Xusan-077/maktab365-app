"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, LogOut, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSignOut } from "@/hooks/useSignOut";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar } from "@/components/layout/UserMenu";
import { adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROUTES } from "@/lib/utils/routes";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { useAdminIdentity } from "./AdminRoleProvider";
import { adminNavFor } from "./admin-nav";

const linkClasses =
  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";
const idleClasses = "text-muted hover:bg-subtle hover:text-foreground";
const activeClasses = "bg-primary-soft text-primary-soft-foreground";

/** Yangi (ko'rilmagan) xabarlar soni: sidebar va mobil menyudagi "Xabarlar" belgisi. */
function useNewMessages(): number {
  const { data } = useQuery(adminQueries.supportSummary());
  return data?.new ?? 0;
}

function NewBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  const t = useTranslations("admin.nav");
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      data-testid="admin-messages-badge"
      aria-label={t("newMessages", { count })}
      className={cn(
        "bg-danger rounded-pill inline-flex min-w-5 items-center justify-center px-1.5 text-xs leading-5 font-bold text-white tabular-nums",
        compact
          ? "absolute -top-1 left-1/2 ml-1.5 h-4 min-w-4 px-1 text-[0.625rem] leading-4"
          : "ml-auto",
      )}
    >
      {label}
    </span>
  );
}

function AdminSidebar() {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const { role, email } = useAdminIdentity();
  const newMessages = useNewMessages();
  const signOut = useSignOut();

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
              {key === "messages" && <NewBadge count={newMessages} />}
            </Link>
          );
        })}
      </nav>

      {/* Admin saytni oddiy foydalanuvchidek ko'radi: yangi oynada ochiq sayt. */}
      <Link
        href={ROUTES.home}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="admin-open-site"
        className={cn(linkClasses, idleClasses)}
      >
        <ExternalLink className="size-5 shrink-0" aria-hidden />
        {t("nav.openSite")}
        <span aria-hidden>↗</span>
      </Link>

      <div className="border-border flex flex-col gap-1 border-t pt-3">
        <div className="mt-2 flex items-center gap-3 px-2">
          <Avatar name={email ?? ""} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{email}</p>
            <p className="text-muted truncate text-xs">{t(`roles.${role}`)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
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
  const t = useTranslations("admin.nav");
  return (
    <header
      data-admin-topbar
      className="border-border bg-background sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 sm:px-6 print:hidden"
    >
      <Logo variant="mark" height={22} href={ADMIN_ROUTES.home} className="lg:hidden" />
      <AdminSearch />
      <div className="ml-auto flex items-center gap-2">
        <Link
          href={ROUTES.home}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("openSite")}
          className="text-foreground hover:bg-subtle inline-flex size-10 items-center justify-center rounded-lg lg:hidden"
        >
          <ExternalLink className="size-5" aria-hidden />
        </Link>
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
  const newMessages = useNewMessages();

  return (
    <nav
      aria-label={t("mobile")}
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
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
            <span className="relative">
              <Icon className="size-5" aria-hidden />
              {key === "messages" && <NewBadge count={newMessages} compact />}
            </span>
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
