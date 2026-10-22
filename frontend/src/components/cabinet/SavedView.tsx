"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { SavedBooks } from "./SavedBooks";

/** "Saqlanganlar": saqlangan barcha darsliklar (o'quvchi va o'qituvchi uchun bir xil). */
export function SavedView() {
  const t = useTranslations("library.saved");
  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} />
      <SavedBooks />
    </div>
  );
}
