"use client";

import { usePathname } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { SiteFooter } from "./SiteFooter";

/** Bosh sahifada to'liq footer, qolgan ochiq sahifalarda ixcham (logo + huquqiy havolalar + ©). */
export function MarketingFooter() {
  const pathname = usePathname();
  return <SiteFooter variant={pathname === ROUTES.home ? "full" : "compact"} />;
}
