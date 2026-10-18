"use client";

import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useAppBase } from "@/hooks/useAppBase";
import { Link } from "@/lib/i18n/navigation";
import { baseHome } from "@/lib/utils/routes";
import { Logo } from "./Logo";
import { MAIN_CONTENT_ID } from "./SkipLink";

/**
 * Xato (error.tsx) va 404 (not-found.tsx) uchun umumiy holat. `onRetry` berilsa — qayta urinish tugmasi.
 * `standalone` (default) — sahifada layout yo'q: logo va o'z `<main>`i bilan chiziladi; marketing/panel
 * layout ichida `standalone={false}` bo'ladi va layout'ning header/sidebar'i saqlanadi.
 */
export function ErrorState({
  variant,
  onRetry,
  standalone = true,
}: {
  variant: "error" | "notFound";
  onRetry?: () => void;
  standalone?: boolean;
}) {
  const t = useTranslations("errors");
  const base = useAppBase();

  const content = (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      {standalone && <Logo height={36} />}
      <h1 className="text-3xl font-bold tracking-tight">
        {variant === "error" ? t("title") : t("notFoundTitle")}
      </h1>
      <p className="text-muted text-lg">{variant === "error" ? t("text") : t("notFoundText")}</p>
      <div className="flex flex-wrap gap-3">
        {onRetry && <Button onClick={onRetry}>{t("retry")}</Button>}
        <Link
          href={baseHome(base)}
          className={buttonVariants({ variant: onRetry ? "secondary" : "primary" })}
        >
          {t("home")}
        </Link>
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
