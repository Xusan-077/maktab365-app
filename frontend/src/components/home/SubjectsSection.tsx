"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import { listItem, m } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatGrades } from "@/lib/admin/grades";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES } from "@/types/catalog";
import { SUBJECTS_ID } from "./ids";
import { Section } from "./Section";

/** Fan kartalari uchun nozik rang aksentlari (fan slug'i bo'yicha barqaror tanlanadi). */
const ACCENTS = [
  "from-primary-100 to-primary-50",
  "from-amber-100 to-amber-50",
  "from-emerald-100 to-emerald-50",
  "from-sky-100 to-sky-50",
  "from-rose-100 to-rose-50",
  "from-violet-100 to-violet-50",
] as const;

const accentOf = (slug: string) =>
  ACCENTS[[...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % ACCENTS.length];

const catalogHref = (subject: string, grade?: number) =>
  `${ROUTES.textbooks}?${new URLSearchParams({ ...(grade ? { grade: String(grade) } : {}), subject })}`;

/** Bosh sahifadagi "Fanlar" bo'limi. */
export function SubjectsSection() {
  const t = useTranslations("home.subjects");
  return (
    <Section id={SUBJECTS_ID} title={t("title")} description={t("hint")}>
      <SubjectsGrid />
    </Section>
  );
}

/** Sinf bo'yicha filtr + bosiladigan fan kartalari (bosh sahifa va `/fanlar` uchun umumiy). */
export function SubjectsGrid() {
  const t = useTranslations("home.subjects");
  const locale = useLocale() as Locale;
  const [grade, setGrade] = useState<number | undefined>();
  const subjects = useQuery(pdfQueries.subjects(grade));

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip selected={!grade} onClick={() => setGrade(undefined)}>
          {t("allGrades")}
        </Chip>
        {GRADES.map((value) => (
          <Chip key={value} selected={grade === value} onClick={() => setGrade(value)}>
            {t("gradeLabel", { grade: value })}
          </Chip>
        ))}
      </div>

      {subjects.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : subjects.isError ? (
        <p className="text-muted text-sm">{t("error")}</p>
      ) : subjects.data.length === 0 ? (
        <p className="text-muted text-sm">{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.data.map((subject, index) => (
            <m.li
              key={subject.slug}
              custom={index}
              initial="hidden"
              animate="show"
              variants={listItem}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="group border-border bg-surface relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div
                aria-hidden
                className={cn(
                  "absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br opacity-70 transition-transform duration-300 group-hover:scale-150",
                  accentOf(subject.slug),
                )}
              />
              <div className="relative flex items-start justify-between gap-3">
                <span className="bg-primary-soft text-primary-soft-foreground inline-flex size-10 items-center justify-center rounded-xl">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <ArrowUpRight
                  className="text-muted size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </div>
              <div className="relative">
                <h3 className="text-base font-semibold">
                  <Link
                    href={catalogHref(subject.slug, grade)}
                    className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4"
                  >
                    {getLocalized(subject.title, locale)}
                  </Link>
                </h3>
                <p className="text-muted mt-1 text-sm">
                  {t("meta", {
                    grades: formatGrades(subject.grades),
                    count: subject.books_count,
                  })}
                </p>
              </div>
              {/* Sinf chiplari kartaning "cho'zilgan" havolasi ustida turadi (z-10) */}
              <div className="relative z-10 flex flex-wrap gap-1.5">
                {subject.grades.map((value) => (
                  <Link
                    key={value}
                    href={catalogHref(subject.slug, value)}
                    aria-label={t("openGrade", {
                      subject: getLocalized(subject.title, locale),
                      grade: value,
                    })}
                    className="border-border bg-surface hover:border-primary-300 hover:bg-primary-soft rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
                  >
                    {value}
                  </Link>
                ))}
              </div>
            </m.li>
          ))}
        </ul>
      )}
    </>
  );
}
