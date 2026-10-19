"use client";

import { useState, type ComponentType } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { BookOpen, LayoutGrid, Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils/cn";
import { dashboardPath, ROUTES } from "@/lib/utils/routes";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SearchForm } from "./SearchForm";
import { SignInButton } from "./SignInButton";
import { TextSizeControl } from "./TextSizeControl";
import { ThemeToggle } from "./ThemeToggle";

const itemClasses =
  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition-colors";

function BarLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(itemClasses, active ? "text-link" : "text-muted hover:text-foreground")}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

function BarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(itemClasses, "text-muted hover:text-foreground")}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </button>
  );
}

/** lg dan kichik ekranlarda pastki navigatsiya: Darsliklar, Fanlar, Qidiruv va Menyu doim bir tegish uzoqlikda. */
export function MobileNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { signedIn } = useAuth();
  const { data: me } = useMe();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label={t("nav.mobile")}
        className="border-border bg-surface/95 present:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden print:hidden"
      >
        <BarLink
          href={ROUTES.textbooks}
          icon={BookOpen}
          label={t("nav.textbooks")}
          active={isActive(ROUTES.textbooks)}
        />
        <BarLink
          href={ROUTES.subjects}
          icon={LayoutGrid}
          label={t("nav.subjects")}
          active={isActive(ROUTES.subjects)}
        />
        <BarButton icon={Search} label={t("nav.search")} onClick={() => setSearchOpen(true)} />
        <BarButton icon={Menu} label={t("nav.menu")} onClick={() => setMenuOpen(true)} />
      </nav>

      <Dialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={t("nav.search")}
        placement="bottom"
      >
        <SearchForm autoFocus />
      </Dialog>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen} title={t("menu.title")} placement="bottom">
        <ul className="flex flex-col">
          <li>
            <Link
              href={ROUTES.about}
              onClick={() => setMenuOpen(false)}
              className="hover:bg-subtle flex min-h-12 items-center rounded-lg px-2 text-base font-medium"
            >
              {t("nav.about")}
            </Link>
          </li>
        </ul>
        <div className="border-border flex flex-col gap-3 border-t pt-4">
          <p className="text-muted text-sm font-medium">{t("menu.appearance")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <TextSizeControl />
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
        {signedIn ? (
          <div className="flex flex-col gap-2">
            {me !== undefined && (
              <Link
                href={me ? dashboardPath(me.role) : ROUTES.onboarding}
                onClick={() => setMenuOpen(false)}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                {me?.role === "teacher" ? t("nav.goToTeacher") : t("nav.goToCabinet")}
              </Link>
            )}
            <Link
              href={ROUTES.settings}
              onClick={() => setMenuOpen(false)}
              className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
            >
              {t("auth.settings")}
            </Link>
          </div>
        ) : (
          <SignInButton size="lg" className="w-full">
            {t("nav.login")}
          </SignInButton>
        )}
      </Dialog>
    </>
  );
}
