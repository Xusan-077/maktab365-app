import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";

export function SearchForm({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const t = useTranslations("search");
  const locale = useLocale();
  return (
    <form
      role="search"
      action={getPathname({ href: ROUTES.search, locale })}
      method="get"
      className={cn("relative", className)}
    >
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        autoFocus={autoFocus}
        aria-label={t("label")}
        placeholder={t("placeholder")}
        className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-10 w-full rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors"
      />
      <button type="submit" className="sr-only">
        {t("submit")}
      </button>
    </form>
  );
}
