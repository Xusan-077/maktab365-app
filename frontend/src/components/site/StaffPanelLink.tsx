"use client";

import { LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Ochiq sayt sarlavhasida staff (muharrir/admin) uchun "Boshqaruv paneli" havolasi: admin saytni
 * oddiy foydalanuvchidek ko'radi, panelga bir bosishda qaytadi. Mobilda faqat ikonka.
 */
export function StaffPanelLink({ className }: { className?: string }) {
  const t = useTranslations("site");
  const { sessionUser } = useAuth();
  if (!sessionUser?.staff) return null;
  return (
    <Link
      href={ADMIN_ROUTES.home}
      aria-label={t("adminPanel")}
      data-testid="staff-panel-link"
      className={cn(
        "border-border bg-surface hover:bg-surface-2 text-foreground inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-[0.9375rem] font-semibold max-sm:w-11 max-sm:px-0",
        className,
      )}
    >
      <LayoutDashboard className="size-5" aria-hidden />
      <span className="max-sm:sr-only">{t("adminPanel")}</span>
    </Link>
  );
}
