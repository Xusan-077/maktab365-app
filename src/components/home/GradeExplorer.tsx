"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Atom,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe2,
  Languages,
  Leaf,
  Monitor,
  Shapes,
  Sigma,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBooks } from "@/hooks/useBooks";
import { useGrades } from "@/hooks/useGrades";
import { useSubjects } from "@/hooks/useSubjects";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES, type Grade } from "@/types/catalog";
import { Section } from "./Section";

const GRADE_PARAM = "grade";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const SUBJECT_ICONS: Record<string, IconComponent> = {
  math: Calculator,
  algebra: Sigma,
  geometry: Shapes,
  english: Languages,
  "mother-tongue": BookOpen,
  history: Globe2,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Leaf,
  informatics: Monitor,
};

function parseGrade(value: string | null): Grade | null {
  const grade = Number(value);
  return GRADES.find((item) => item === grade) ?? null;
}

/** 1–11 sinf chiplari + fanlar kartochkalari. Tanlangan sinf `?grade=` ga yoziladi (sahifa qayta yuklanmaydi). */
export function GradeExplorer() {
  const t = useTranslations("home");
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const searchParams = useSearchParams();
  const [grade, setGrade] = useState<Grade | null>(() => parseGrade(searchParams.get(GRADE_PARAM)));

  const grades = useGrades();
  const books = useBooks();
  const subjects = useSubjects();

  const cards = useMemo(() => {
    const allBooks = books.data ?? [];
    return (subjects.data ?? [])
      .map((subject) => {
        const subjectBooks = allBooks.filter(
          (book) => book.subjectId === subject.id && (grade === null || book.grade === grade),
        );
        return {
          subject,
          count: subjectBooks.length,
          ready: subjectBooks.some((book) => book.topicsReady),
        };
      })
      .filter((card) => card.count > 0);
  }, [books.data, subjects.data, grade]);

  function selectGrade(next: Grade | null) {
    setGrade(next);
    const url = new URL(window.location.href);
    if (next === null) url.searchParams.delete(GRADE_PARAM);
    else url.searchParams.set(GRADE_PARAM, String(next));
    window.history.replaceState(null, "", url);
  }

  const pending = books.isPending || subjects.isPending;
  const failed = books.isError || subjects.isError;

  return (
    <>
      <Section
        id="grades"
        title={t("grades.title")}
        description={t("grades.hint")}
        className="pb-0 lg:pb-0"
      >
        <div role="group" aria-label={t("grades.label")} className="flex flex-wrap gap-2">
          <Chip selected={grade === null} onClick={() => selectGrade(null)} className="h-11 px-4">
            {t("grades.reset")}
          </Chip>
          {(grades.data ?? GRADES).map((item) => (
            <Chip
              key={item}
              selected={grade === item}
              aria-label={t("grades.chip", { grade: item })}
              onClick={() => selectGrade(item)}
              className="h-11 min-w-11 justify-center text-base"
            >
              {item}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        id="subjects"
        title={t("subjects.title")}
        description={
          <span aria-live="polite">
            {grade === null ? t("subjects.subtitleAll") : t("subjects.subtitleGrade", { grade })}
          </span>
        }
      >
        {failed ? (
          <p role="alert" className="text-danger">
            {t("subjects.error")}
          </p>
        ) : pending ? (
          <div
            aria-busy="true"
            aria-label={t("subjects.loading")}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className="text-muted">{t("subjects.empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ subject, count, ready }) => {
              const Icon = SUBJECT_ICONS[subject.id] ?? BookOpen;
              const query = new URLSearchParams({ subject: subject.id });
              if (grade !== null) query.set(GRADE_PARAM, String(grade));
              return (
                <li key={subject.id}>
                  <Card interactive className="relative flex h-full items-start gap-4">
                    <span className="bg-primary-soft text-primary-soft-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Link
                        href={`${ROUTES.textbooks}?${query.toString()}`}
                        className="text-foreground rounded-md text-base font-semibold after:absolute after:inset-0 after:rounded-xl"
                      >
                        {getLocalized(subject.name, locale)}
                      </Link>
                      <p className="text-muted text-sm">{t("subjects.booksCount", { count })}</p>
                      <Badge variant={ready ? "success" : "neutral"} className="self-start">
                        {ready ? t("subjects.ready") : t("subjects.soon")}
                      </Badge>
                    </div>
                    <ArrowRight className="text-muted size-4 shrink-0" aria-hidden />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

/** Suspense fallback: chiplar va kartochkalar o'rni band bo'lib turadi (layout sakramaydi). */
export function GradeExplorerSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="mb-10 flex flex-wrap gap-2">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-11 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
