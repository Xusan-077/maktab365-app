"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { SavedList } from "./SavedList";

/** "Saqlanganlar": xatcho'pga olingan barcha mavzular. */
export function SavedView() {
  const t = useTranslations("cabinet");

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("saved.title")} />
      <SavedList />
    </div>
  );
}
