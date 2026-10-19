"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { SavedMaterials } from "./SavedMaterials";

/** "Saqlanganlar": saqlangan kitoblar va mavzular. */
export function TeacherSavedView() {
  const t = useTranslations("teacher.saved");
  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("pageTitle")} />
      <SavedMaterials />
    </div>
  );
}
