"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useSubjects } from "@/hooks/useSubjects";
import { useTeacherSelection } from "@/hooks/useTeacherSelection";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { toggleValue } from "@/lib/utils/teacher-filters";
import { useTeacherStore } from "@/stores/teacher.store";
import { GRADES } from "@/types/catalog";

/**
 * Fan va sinf filtri. Boshida o'qituvchi profilidagi fan/sinflar tanlangan; istalgan chipni
 * bosib o'zgartirish mumkin, hech biri tanlanmasa — cheklov yo'q.
 */
export function FilterBar() {
  const t = useTranslations("teacher.filter");
  const tg = useTranslations("home.grades");
  const locale = useLocale() as Locale;
  const { data: subjects = [] } = useSubjects();
  const selection = useTeacherSelection();
  const setSubjects = useTeacherStore((state) => state.setSubjects);
  const setGrades = useTeacherStore((state) => state.setGrades);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("subjects")} className="flex flex-wrap items-center gap-2">
        <span className="text-muted text-sm font-medium">{t("subjects")}</span>
        {subjects.map((subject) => (
          <Chip
            key={subject.id}
            selected={selection.subjects.includes(subject.id)}
            onClick={() => setSubjects(toggleValue(selection.subjects, subject.id))}
          >
            {getLocalized(subject.name, locale)}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label={t("grades")} className="flex flex-wrap items-center gap-2">
        <span className="text-muted text-sm font-medium">{t("grades")}</span>
        {GRADES.map((grade) => (
          <Chip
            key={grade}
            selected={selection.grades.includes(grade)}
            onClick={() => setGrades(toggleValue(selection.grades, grade))}
          >
            {tg("chip", { grade })}
          </Chip>
        ))}
      </div>
      {selection.isCustom && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSubjects(null);
              setGrades(null);
            }}
          >
            {t("reset")}
          </Button>
        </div>
      )}
    </div>
  );
}
