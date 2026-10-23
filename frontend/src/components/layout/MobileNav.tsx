"use client";

import type { ComponentType } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { BookOpen, GraduationCap, House, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";

const itemClasses =
  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[0.6875rem] font-medium transition-colors";

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

/** lg dan kichik ekranlarda pastki navigatsiya: Bosh sahifa, Darsliklar, Fanlar va Loyiha haqida. Qidiruv — sarlavhada. */
export function MobileNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={t("nav.mobile")}
      className="border-border bg-surface present:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
    >
      <BarLink
        href={ROUTES.home}
        icon={House}
        label={t("nav.home")}
        active={pathname === ROUTES.home}
      />
      <BarLink
        href={ROUTES.textbooks}
        icon={BookOpen}
        label={t("nav.textbooks")}
        active={isActive(ROUTES.textbooks)}
      />
      <BarLink
        href={ROUTES.subjects}
        icon={GraduationCap}
        label={t("nav.subjects")}
        active={isActive(ROUTES.subjects)}
      />
      <BarLink
        href={ROUTES.about}
        icon={Info}
        label={t("nav.about")}
        active={isActive(ROUTES.about)}
      />
    </nav>
  );
}
