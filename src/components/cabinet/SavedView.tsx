"use client";

import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { catalogPath } from "@/lib/utils/routes";
import { SavedList } from "./SavedList";

const CABINET_CATALOG = catalogPath("kabinet");

/** "Saqlanganlar": xatcho'pga olingan barcha mavzular. */
export function SavedView() {
  const t = useTranslations("cabinet");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("saved.title")}</h1>
      <SavedList />
      <div>
        <Link href={CABINET_CATALOG} className={buttonVariants({ variant: "secondary" })}>
          {t("browse")}
        </Link>
      </div>
    </div>
  );
}
