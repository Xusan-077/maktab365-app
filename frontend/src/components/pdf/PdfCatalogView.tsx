"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/admin/Pagination";
import { useDebouncedSearch } from "@/components/admin/useDebouncedSearch";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { PDF_PAGE_SIZE, type PdfBookFilters } from "@/lib/pdf-books/api";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { GRADES } from "@/types/catalog";
import { PdfBookCard, PdfBookCardSkeleton } from "./PdfBookCard";

const positiveInt = (raw: string | null) => (raw && /^\d+$/.test(raw) ? Number(raw) : undefined);

/** URL → filtrlar (noto'g'ri qiymatlar tashlanadi). */
export function parsePdfFilters(params: { get(name: string): string | null }): PdfBookFilters {
  const grade = positiveInt(params.get("grade"));
  const page = positiveInt(params.get("page"));
  return {
    grade: grade && grade >= 1 && grade <= 11 ? grade : undefined,
    subject: params.get("subject")?.trim() || undefined,
    q: params.get("q")?.trim() || undefined,
    page: page && page > 1 ? page : undefined,
  };
}

export function serializePdfFilters(filters: PdfBookFilters): string {
  const query = new URLSearchParams();
  if (filters.grade) query.set("grade", String(filters.grade));
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.q) query.set("q", filters.q);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
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

  const [search, setSearch] = useDebouncedSearch(filters.q, (q) =>
    navigate({ ...filters, q, page: undefined }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div role="search" className="relative max-w-md">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          data-testid="pdf-search"
          className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-10 w-full rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors"
        />
      </div>

      <section aria-labelledby="pdf-grades" className="flex flex-col gap-2">
        <h2 id="pdf-grades" className="text-muted text-sm font-medium">
          {t("gradeFilter")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={!filters.grade}
            data-testid="pdf-grade-all"
            onClick={() => navigate({ q: filters.q })}
          >
            {t("allGrades")}
          </Chip>
          {GRADES.map((grade) => (
            <Chip
              key={grade}
              selected={filters.grade === grade}
              data-testid={`pdf-grade-${grade}`}
              onClick={() => navigate({ grade, q: filters.q })}
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
              selected={!filters.subject}
              data-testid="pdf-subject-all"
              onClick={() => navigate({ grade: filters.grade, q: filters.q })}
            >
              {t("allSubjects")}
            </Chip>
            {subjects.data?.map((subject) => (
              <Chip
                key={subject.slug}
                selected={filters.subject === subject.slug}
                data-testid={`pdf-subject-${subject.slug}`}
                onClick={() =>
                  navigate({ grade: filters.grade, subject: subject.slug, q: filters.q })
                }
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
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <PdfBookCardSkeleton key={i} />
          ))}
        </div>
      ) : books.data.results.length === 0 ? (
        <EmptyState icon={FileText}>
          {filters.grade || filters.subject || filters.q ? t("emptyFiltered") : t("empty")}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
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
