"use client";

import { useTranslations } from "next-intl";
import { useMyBooks } from "@/hooks/useMyBooks";
import { SubjectsList } from "./SubjectsList";

/** "Fanlarim": sinfga mos barcha fanlar va ularda o'qilgan mavzular. */
export function SubjectsView() {
  const t = useTranslations("cabinet");
  const { grade } = useMyBooks();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("nav.subjects")}</h1>
        {grade !== undefined && <p className="text-muted">{t("subjects.pageLead", { grade })}</p>}
      </header>
      <SubjectsList />
    </div>
  );
}
