import { Suspense, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookCover } from "@/components/site/BookCover";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/site/Breadcrumbs";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import type { PdfBookDetail } from "@/lib/pdf-books/api";
import { catalogHref, EMPTY_FILTERS } from "@/lib/pdf/catalog-filters";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/lib/pdf/grade-groups";
import { formatBytes } from "@/lib/utils/bytes";
import { formatDate } from "@/lib/utils/format-date";
import { ROUTES } from "@/lib/utils/routes";
import { BookHeroProgress } from "./BookHeroProgress";

const isGroup = (value: string): value is SubjectGroup =>
  (SUBJECT_GROUPS as readonly string[]).includes(value);

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface flex min-w-0 flex-col gap-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
      <dt className="text-faint text-[0.8125rem]">{label}</dt>
      <dd className="text-[0.9375rem] font-semibold break-words">{value}</dd>
    </div>
  );
}

/**
 * Kitob sahifasining hero qismi: yo'l, muqova (600px variant), belgilar, nom, faktlar jadvali,
 * o'qish progressi (klientda) va harakatlar (`actions` slot'i).
 */
export function BookHero({
  book,
  breadcrumbs,
  actions,
}: {
  book: PdfBookDetail;
  breadcrumbs: BreadcrumbItem[];
  actions: ReactNode;
}) {
  const t = useTranslations("pdfBooks.page");
  const ts = useTranslations("site");
  const locale = useLocale() as Locale;
  const title = getLocalized(book.title, locale);
  const subjectTitle = getLocalized(book.subject_title, locale);
  const group = isGroup(book.subject_group) ? book.subject_group : null;
  const language = (book.language ?? "uz") as "uz" | "ru" | "en";
  const languageLabel = ts.has(`language.${language}`) ? ts(`language.${language}`) : null;
  const added = book.published_at ? formatDate(book.published_at, locale, "date") : null;

  return (
    <section className="bg-hero-bg border-border border-b">
      <div className="max-w-site mx-auto flex flex-col gap-7 px-4 pt-8 pb-12 sm:px-8 sm:pb-14">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex flex-wrap items-start gap-8 sm:gap-14">
          <BookCover
            grade={book.grade}
            title={subjectTitle}
            group={book.subject_group}
            src={book.cover}
            srcSmall={book.cover_small}
            srcLarge={book.cover_large}
            priority
            sizes="(min-width: 640px) 320px, 160px"
            className="shadow-cover w-40 max-w-full sm:w-80"
          />
          <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {group && (
                <Link
                  href={catalogHref(ROUTES.textbooks, EMPTY_FILTERS, { groups: [group] })}
                  className="bg-brand-soft text-brand-text rounded-pill flex h-8 items-center px-3 text-sm font-semibold hover:underline"
                >
                  {ts(`groupName.${group}`)}
                </Link>
              )}
              {languageLabel && (
                <span className="bg-surface border-input-border rounded-pill flex h-8 items-center border px-3 text-sm font-semibold">
                  {languageLabel}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-[2.5rem] leading-none font-extrabold tracking-[-0.03em] text-balance sm:text-[3.5rem]">
                {title}
              </h1>
              <p className="text-muted text-xl font-semibold sm:text-[1.375rem]">
                {t("subtitle", { grade: book.grade })}
              </p>
            </div>

            {/* Mobilda 2 ustun (6 fakt — 3×2; toq bo'lsa oxirgisi to'liq qator), kengroq ekranda sig'ganicha. */}
            <dl
              data-testid="book-facts"
              className="bg-border border-border grid max-w-[38.75rem] grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-[repeat(auto-fill,minmax(11.25rem,1fr))] max-sm:[&>*:last-child:nth-child(odd)]:col-span-2"
            >
              <Fact
                label={t("passport.grade")}
                value={t("passport.gradeValue", { grade: book.grade })}
              />
              <Fact label={t("passport.subject")} value={subjectTitle} />
              <Fact
                label={t("passport.pages")}
                value={t("passport.pagesValue", { count: book.page_count })}
              />
              {book.size_bytes > 0 && (
                <Fact
                  label={t("passport.size")}
                  value={`${formatBytes(book.size_bytes)} · ${t("badges.pdf")}`}
                />
              )}
              {languageLabel && (
                <Fact label={t("passport.language")} value={t(`passport.languages.${language}`)} />
              )}
              {added && <Fact label={t("passport.added")} value={added} />}
            </dl>

            {/* useQuery (progress) Suspense talab qiladi: prerender paytida bo'sh, brauzerda to'ladi. */}
            <Suspense fallback={null}>
              <BookHeroProgress bookId={book.id} pageCount={book.page_count} />
            </Suspense>
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}
