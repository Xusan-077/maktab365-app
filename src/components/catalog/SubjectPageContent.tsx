import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getRootCrumb, getSubjectsCrumb, pageShellClass } from "@/components/layout/crumbs";
import { getSubjectPageData } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import type { AppBase } from "@/lib/utils/routes";
import type { Book, Grade } from "@/types/catalog";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookCard } from "./BookCard";

/** Fan sahifasi (sinflar bo'yicha kitoblar): marketing `/fanlar/[subject]` va panellardagi nusxalari. */
export async function SubjectPageContent({
  slug,
  base,
  locale,
}: {
  slug: string;
  base: AppBase;
  locale: Locale;
}) {
  const data = await getSubjectPageData(slug);
  if (!data) notFound();

  const { subject, books } = data;
  const t = await getTranslations("subjectsPage");
  const name = getLocalized(subject.name, locale);
  const crumbs =
    base === "marketing"
      ? [await getRootCrumb(base), await getSubjectsCrumb(base), { label: name }]
      : [await getSubjectsCrumb(base), { label: name }];

  const byGrade = new Map<Grade, Book[]>();
  for (const book of books) byGrade.set(book.grade, [...(byGrade.get(book.grade) ?? []), book]);
  const grades = [...byGrade.keys()].sort((a, b) => a - b);

  return (
    <div className={cn("flex flex-col gap-8", pageShellClass(base))}>
      <Breadcrumbs items={crumbs} />
      <PageHeader title={name} description={t("booksCount", { count: books.length })} />
      {grades.length === 0 && <EmptyState icon={BookOpen}>{t("empty")}</EmptyState>}
      {grades.map((grade) => (
        <section key={grade} aria-labelledby={`grade-${grade}`} className="flex flex-col gap-4">
          <h2 id={`grade-${grade}`} className="text-xl font-semibold">
            {t("gradeHeading", { grade })}
          </h2>
          <ul className="grid gap-4 lg:grid-cols-2">
            {(byGrade.get(grade) ?? []).map((book) => (
              <li key={book.id}>
                <BookCard book={book} subjectName={subject.name} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
