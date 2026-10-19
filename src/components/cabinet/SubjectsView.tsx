"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { useMyBooks } from "@/hooks/useMyBooks";
import { SubjectsList } from "./SubjectsList";

/** "Fanlarim": sinfga mos barcha fanlar va ularda o'qilgan mavzular. */
export function SubjectsView() {
  const t = useTranslations("cabinet");
  const { grade } = useMyBooks();

  return (
    <div className={PAGE_STACK}>
      <PageHeader
        title={t("nav.subjects")}
        description={grade !== undefined ? t("subjects.pageLead", { grade }) : undefined}
      />
      <SubjectsList />
    </div>
  );
}
