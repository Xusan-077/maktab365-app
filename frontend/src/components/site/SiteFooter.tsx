import { useTranslations } from "next-intl";
import { Logo } from "@/components/layout/Logo";
import { TELEGRAM_BOT_USERNAME } from "@/lib/auth/config";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";

/** `new Date()` prerender'da (cacheComponents) ishlatilmaydi — yil qo'lda yangilanadi. */
export const COPYRIGHT_YEAR = 2026;

const linkClasses =
  "text-muted hover:text-foreground flex min-h-8 items-center rounded-md text-[0.9375rem] transition-colors";

/** `full` — bosh sahifa (logo, tagline, 2 ustun havolalar); `compact` — qolgan sahifalar (logo + ©). */
const legalLink = "hover:text-foreground flex min-h-11 items-center rounded-md transition-colors";

export function SiteFooter({ variant = "compact" }: { variant?: "full" | "compact" }) {
  const t = useTranslations("site.footer");
  const telegramHref = TELEGRAM_BOT_USERNAME ? `https://t.me/${TELEGRAM_BOT_USERNAME}` : null;
  const copyright = t("copyright", { year: COPYRIGHT_YEAR });

  if (variant === "compact") {
    return (
      <footer className="border-border bg-footer-bg present:hidden border-t print:hidden">
        <div className="max-w-site text-faint mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-7 text-sm sm:px-8">
          <Logo height={24} />
          <nav aria-label={t("legal")} className="flex flex-wrap gap-x-5">
            <Link href={ROUTES.terms} className={legalLink}>
              {t("terms")}
            </Link>
            <Link href={ROUTES.privacy} className={legalLink}>
              {t("privacy")}
            </Link>
          </nav>
          <span>{copyright}</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-border bg-footer-bg present:hidden border-t print:hidden">
      <div className="max-w-site mx-auto flex flex-wrap gap-x-12 gap-y-10 px-4 pt-12 pb-8 sm:px-8">
        <div className="flex flex-[1_1_20rem] flex-col gap-3.5">
          <Logo height={28} />
          <p className="text-muted max-w-[21rem] text-[0.9375rem] leading-relaxed">
            {t("tagline")}
          </p>
        </div>
        <nav aria-labelledby="site-footer-pages" className="flex flex-[0_1_11rem] flex-col gap-2.5">
          <span id="site-footer-pages" className="font-bold">
            {t("pages")}
          </span>
          <Link href={ROUTES.subjects} className={linkClasses}>
            {t("subjects")}
          </Link>
          <Link href={ROUTES.textbooks} className={linkClasses}>
            {t("textbooks")}
          </Link>
          <Link href={ROUTES.about} className={linkClasses}>
            {t("about")}
          </Link>
          {telegramHref && (
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClasses}
            >
              {t("telegram")}
            </a>
          )}
        </nav>
        <nav aria-labelledby="site-footer-help" className="flex flex-[0_1_11rem] flex-col gap-2.5">
          <span id="site-footer-help" className="font-bold">
            {t("help")}
          </span>
          <Link href={ROUTES.contact} className={linkClasses}>
            {t("contact")}
          </Link>
          <Link href={ROUTES.help} className={linkClasses}>
            {t("helpCenter")}
          </Link>
          <Link href={ROUTES.terms} className={linkClasses}>
            {t("terms")}
          </Link>
          <Link href={ROUTES.privacy} className={linkClasses}>
            {t("privacy")}
          </Link>
        </nav>
      </div>
      <div className="border-border border-t">
        <p className={cn("max-w-site text-faint mx-auto px-4 pt-[1.125rem] pb-7 text-sm sm:px-8")}>
          {copyright}
        </p>
      </div>
    </footer>
  );
}
