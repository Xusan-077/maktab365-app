"use client";

import { useTranslations } from "next-intl";
import { SavedMaterials } from "./SavedMaterials";

/** "Saqlanganlar": saqlangan kitoblar va mavzular. */
export function TeacherSavedView() {
  const t = useTranslations("teacher.saved");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
      <SavedMaterials />
    </div>
  );
}
