"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/admin/Pagination";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { PDF_PAGE_SIZE, type PdfBookFilters } from "@/lib/pdf-books/api";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { GRADES } from "@/types/catalog";
import { PdfBookCard } from "./PdfBookCard";

const positiveInt = (raw: string | null) => (raw && /^\d+$/.test(raw) ? Number(raw) : undefined);

/** URL → filtrlar (noto'g'ri qiymatlar tashlanadi). */
export function parsePdfFilters(params: { get(name: string): string | null }): PdfBookFilters {
  const grade = positiveInt(params.get("grade"));
  const page = positiveInt(params.get("page"));
  return {
    grade: grade && grade >= 1 && grade <= 11 ? grade : undefined,
    subject: params.get("subject")?.trim() || undefined,
    page: page && page > 1 ? page : undefined,
  };
}

export function serializePdfFilters(filters: PdfBookFilters): string {
  const query = new URLSearchParams();
  if (filters.grade) query.set("grade", String(filters.grade));
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}

function Chip({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "border-border bg-surface hover:border-primary-300 min-h-10 rounded-full border px-4 text-sm font-medium transition-colors",
        active && "border-primary-600 bg-primary-soft text-primary-soft-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Ochiq PDF katalog: sinf → fan → kitoblar; filtrlar URL'da. */
export function PdfCatalogView() {
  const t = useTranslations("pdfBooks.catalog");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parsePdfFilters(searchParams), [searchParams]);
  const resume = usePdfProgressMap();
  const subjects = useQuery(pdfQueries.subjects(filters.grade));
  const books = useQuery(pdfQueries.list(filters));

  const navigate = (next: PdfBookFilters) => {
    const query = serializePdfFilters(next);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="pdf-grades" className="flex flex-col gap-2">
        <h2 id="pdf-grades" className="text-muted text-sm font-medium">
          {t("gradeFilter")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={!filters.grade}
            testId="pdf-grade-all"
            onClick={() => navigate({ subject: undefined })}
          >
            {t("allGrades")}
          </Chip>
          {GRADES.map((grade) => (
            <Chip
              key={grade}
              active={filters.grade === grade}
              testId={`pdf-grade-${grade}`}
              onClick={() => navigate({ grade, subject: undefined })}
            >
              {t("gradeLabel", { grade })}
            </Chip>
          ))}
        </div>
      </section>

      {(subjects.data?.length ?? 0) > 0 && (
        <section aria-labelledby="pdf-subjects" className="flex flex-col gap-2">
          <h2 id="pdf-subjects" className="text-muted text-sm font-medium">
            {t("subjectFilter")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={!filters.subject}
              testId="pdf-subject-all"
              onClick={() => navigate({ grade: filters.grade })}
            >
              {t("allSubjects")}
            </Chip>
            {subjects.data?.map((subject) => (
              <Chip
                key={subject.slug}
                active={filters.subject === subject.slug}
                testId={`pdf-subject-${subject.slug}`}
                onClick={() => navigate({ grade: filters.grade, subject: subject.slug })}
              >
                {getLocalized(subject.title, locale)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {books.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-danger">{t("error")}</p>
          <Button variant="secondary" onClick={() => void books.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : books.isPending ? (
        <div
          role="status"
          aria-label={t("loading")}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : books.data.results.length === 0 ? (
        <EmptyState icon={FileText}>
          {filters.grade || filters.subject ? t("emptyFiltered") : t("empty")}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <ul
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={t("results")}
            data-testid="pdf-book-list"
          >
            {books.data.results.map((book) => (
              <li key={book.id}>
                <PdfBookCard book={book} resumePage={resume[book.id]} />
              </li>
            ))}
          </ul>
          <Pagination
            page={filters.page ?? 1}
            pageSize={PDF_PAGE_SIZE}
            total={books.data.count}
            onPageChange={(page) => navigate({ ...filters, page })}
          />
        </div>
      )}
    </div>
  );
}
