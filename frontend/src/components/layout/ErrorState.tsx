"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useAppBase } from "@/hooks/useAppBase";
import { getPathname, Link } from "@/lib/i18n/navigation";
import { baseHome, catalogPath } from "@/lib/utils/routes";
import { Logo } from "./Logo";
import { MAIN_CONTENT_ID } from "./SkipLink";

function NotFoundSearch() {
  const t = useTranslations("errors");
  const locale = useLocale();
  return (
    <form
      role="search"
      action={getPathname({ href: catalogPath(), locale })}
      method="get"
      className="relative w-full max-w-md"
    >
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-12 w-full rounded-lg border pr-3 pl-10 text-base shadow-xs transition-colors"
      />
    </form>
  );
}

/**
 * Xato (error.tsx) va 404 (not-found.tsx) uchun umumiy holat. `onRetry` berilsa — qayta urinish tugmasi.
 * `standalone` (default) — sahifada layout yo'q: logo va o'z `<main>`i bilan chiziladi; marketing/panel
 * layout ichida `standalone={false}` bo'ladi va layout'ning header/sidebar'i saqlanadi.
 * Har holatda bitta asosiy tugma: 404 da — bosh sahifa, xatoda — "Qayta urinish".
 */
export function ErrorState({
  variant,
  onRetry,
  standalone = true,
}: {
  variant: "error" | "notFound" | "forbidden";
  onRetry?: () => void;
  standalone?: boolean;
}) {
  const t = useTranslations("errors");
  const base = useAppBase();
  const panel = base !== "marketing";
  const notFound = variant === "notFound";
  const forbidden = variant === "forbidden";

  const content = (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
      {standalone && <Logo height={36} />}
      {notFound && (
        <p aria-hidden className="text-primary-600 text-7xl font-bold tracking-tight sm:text-8xl">
          {t("notFoundCode")}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {notFound ? t("notFoundTitle") : forbidden ? t("forbiddenTitle") : t("title")}
        </h1>
        <p className="text-muted text-base text-pretty sm:text-lg">
          {notFound ? t("notFoundText") : forbidden ? t("forbiddenText") : t("text")}
        </p>
      </div>
      {notFound && <NotFoundSearch />}
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && <Button onClick={onRetry}>{t("retry")}</Button>}
        <Link
          href={baseHome(base)}
          className={buttonVariants({ variant: onRetry ? "secondary" : "primary" })}
        >
          {panel ? t("backToPanel") : t("home")}
        </Link>
        {notFound && (
          <Link href={catalogPath()} className={buttonVariants({ variant: "secondary" })}>
            {t("toTextbooks")}
          </Link>
        )}
      </div>
    </div>
  );

  return standalone ? (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none">
      {content}
    </main>
  ) : (
    content
  );
}
