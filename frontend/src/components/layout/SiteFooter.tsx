import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/lib/utils/routes";
import { Logo } from "./Logo";
import { NAV_ITEMS } from "./nav-items";

const linkClasses =
  "inline-flex min-h-11 items-center rounded-md text-sm text-muted transition-colors hover:text-foreground";

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="border-border bg-surface present:hidden mt-16 border-t print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-muted max-w-xs text-sm">{t("brand.tagline")}</p>
        </div>
        <nav aria-labelledby="footer-platform">
          <h2 id="footer-platform" className="mb-3 text-sm font-semibold">
            {t("footer.platform")}
          </h2>
          <ul className="flex flex-col">
            {NAV_ITEMS.map(({ key, href }) => (
              <li key={key}>
                <Link href={href} className={linkClasses}>
                  {t(`nav.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-3 text-sm font-semibold">
            {t("footer.help")}
          </h2>
          <ul className="flex flex-col">
            <li>
              <Link href={ROUTES.help} className={linkClasses}>
                {t("footer.helpCenter")}
              </Link>
            </li>
            <li>
              <Link href={ROUTES.contact} className={linkClasses}>
                {t("footer.contact")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-border border-t">
        <p className="text-muted mx-auto max-w-6xl px-4 py-4 text-sm sm:px-6">
          {t("brand.name")} · {t("footer.note")}
        </p>
      </div>
    </footer>
  );
}
