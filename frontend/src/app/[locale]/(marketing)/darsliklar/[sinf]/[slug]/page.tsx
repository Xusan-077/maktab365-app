import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MARKETING_CONTAINER, PAGE_STACK } from "@/components/layout/containers";
import { JsonLd } from "@/components/pdf/JsonLd";
import { RecordRecentBook } from "@/components/pdf/RecordRecentBook";
import { BookCover } from "@/components/pdf/BookCover";
import { BookActions } from "@/components/pdf/book/BookActions";
import { OfflineButton } from "@/components/pdf/OfflineButton";
import { BookPreview } from "@/components/pdf/book/BookPreview";
import { BookPassport, BookToc, SimilarBooks } from "@/components/pdf/book/BookSections";
import { AllGrades } from "@/components/pdf/grade/GradeParts";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { Badge } from "@/components/ui/Badge";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { getAlternates, OG_IMAGES, SITE_URL } from "@/lib/i18n/seo";
import { parseGradeParam } from "@/lib/pdf/grade-groups";
import { toRecent } from "@/lib/pdf/recent";
import { formatBytes } from "@/lib/utils/bytes";
import { getBookBySlug, getGradeBooks } from "@/lib/pdf-books/server";
import { bookJsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { gradePath, pdfBookPath, ROUTES } from "@/lib/utils/routes";

/**
 * Kitoblar bazada (build vaqtida noma'lum): bitta namuna yo'l oldindan quriladi (prerender uchun
 * parametr kerak), haqiqiy kitoblar birinchi so'rovda quriladi va keshlanadi.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, sinf: "9", slug: "namuna" }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/darsliklar/[sinf]/[slug]">): Promise<Metadata> {
  const { locale, sinf, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (parseGradeParam(sinf) === null) notFound();
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const t = await getTranslations({ locale, namespace: "pdfBooks.page.meta" });
  const title = getLocalized(book.title, locale);
  const pageTitle = t("title", { title, grade: book.grade });
  const description =
    book.description.trim().slice(0, 200) ||
    t("description", {
      title,
      grade: book.grade,
      subject: getLocalized(book.subject_title, locale),
      size: formatBytes(book.size_bytes),
      pages: book.page_count,
    });
  return {
    title: pageTitle,
    description,
    alternates: getAlternates(locale, pdfBookPath(book)),
    openGraph: {
      title: pageTitle,
      description,
      type: "book",
      images: book.cover ? [{ url: book.cover, width: 600, height: 900 }] : OG_IMAGES,
    },
    ...(book.unverified ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BookPage({
  params,
}: PageProps<"/[locale]/darsliklar/[sinf]/[slug]">) {
  const { locale, sinf, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const grade = parseGradeParam(sinf);
  if (grade === null) notFound();
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  if (!book) notFound();
  // Kitob boshqa sinfga ko'chirilgan bo'lsa (slug barqaror): to'g'ri manzilga doimiy yo'naltiriladi.
  if (book.grade !== grade) permanentRedirect(`/${locale}${pdfBookPath(book)}`);

  const [t, tc, tn, tp, gradeBooks] = await Promise.all([
    getTranslations({ locale, namespace: "pdfBooks.page" }),
    getTranslations({ locale, namespace: "pdfBooks.card" }),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "pdfBooks.grade" }),
    getGradeBooks(grade),
  ]);
  const title = getLocalized(book.title, locale);
  const subjectTitle = getLocalized(book.subject_title, locale);
  const gradeLabel = tp("breadcrumb.grade", { grade });

  return (
    <div className={`${MARKETING_CONTAINER} py-8 ${PAGE_STACK}`}>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: ROUTES.home },
          { label: tn("textbooks"), href: ROUTES.textbooks },
          { label: gradeLabel, href: gradePath(grade) },
          { label: title },
        ]}
      />

      {!book.unverified && <RecordRecentBook book={toRecent(book)} />}

      <header className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
        <BookCover
          grade={book.grade}
          subject={book.subject}
          subjectTitle={subjectTitle}
          src={book.cover}
          priority
          className="w-40 sm:w-full"
        />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">{t("badges.pdf")}</Badge>
            <Badge>{t("badges.grade", { grade })}</Badge>
            <Badge>{subjectTitle}</Badge>
            {book.unverified && <Badge variant="accent">{tc("unverified")}</Badge>}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <BookActions
            id={book.id}
            grade={book.grade}
            slug={book.slug}
            title={title}
            sizeBytes={book.size_bytes}
            allowDownload={book.allow_download}
          />
          <OfflineButton
            book={{
              id: book.id,
              slug: book.slug,
              grade: book.grade,
              title: book.title,
              sizeBytes: book.size_bytes,
            }}
          />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          {book.description.trim() && (
            <section aria-labelledby="book-description" className="flex flex-col gap-2">
              <h2 id="book-description" className="text-xl font-semibold tracking-tight">
                {t("description")}
              </h2>
              <p className="text-muted max-w-prose whitespace-pre-line">{book.description}</p>
            </section>
          )}
          <BookToc book={book} />
        </div>
        <BookPassport book={book} subjectTitle={subjectTitle} />
      </div>

      <BookPreview bookId={book.id} pageCount={book.page_count} />
      <SimilarBooks current={book} gradeBooks={gradeBooks} />
      <AllGrades current={grade} />

      <div className="flex flex-col gap-1">
        <ReportErrorLink topicId={book.id} />
      </div>

      <JsonLd
        data={breadcrumbList(SITE_URL, locale, [
          { name: tn("home"), path: ROUTES.home },
          { name: tn("textbooks"), path: ROUTES.textbooks },
          { name: gradeLabel, path: gradePath(grade) },
          { name: title, path: pdfBookPath(book) },
        ])}
      />
      <JsonLd data={bookJsonLd(SITE_URL, locale, book, subjectTitle, book.cover)} />
    </div>
  );
}
