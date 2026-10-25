import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookHero } from "@/components/book/BookHero";
import { BookPageSkeleton } from "@/components/book/BookPageSkeleton";
import { BookSaveButton } from "@/components/book/BookSaveButton";
import { JsonLd } from "@/components/pdf/JsonLd";
import { RecordRecentBook } from "@/components/pdf/RecordRecentBook";
import { BookActions, BookActionsFallback } from "@/components/pdf/book/BookActions";
import { OfflineButton } from "@/components/pdf/OfflineButton";
import { BookStickyBar, BookStickyBarFallback } from "@/components/book/BookStickyBar";
import { BookPreview } from "@/components/pdf/book/BookPreview";
import { BookContents } from "@/components/pdf/book/contents/BookContents";
import { ChapterMastery } from "@/components/pdf/book/contents/ChapterMastery";
import { ContentsResumeCard } from "@/components/pdf/book/contents/ContentsResumeCard";
import {
  OtherGrades,
  SameGradeList,
  sectionHeading,
  SimilarBooks,
} from "@/components/pdf/book/BookSections";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { getAlternates, OG_IMAGES, SITE_URL } from "@/lib/i18n/seo";
import { buildBookContents } from "@/lib/pdf/book-contents";
import { parseGradeParam } from "@/lib/pdf/grade-groups";
import { toRecent } from "@/lib/pdf/recent";
import { formatBytes } from "@/lib/utils/bytes";
import { getBookBySlug, getGradeBooks, getSubjectBooks } from "@/lib/pdf-books/server";
import { bookJsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { gradePath, pdfBookPath, ROUTES } from "@/lib/utils/routes";

/**
 * Kitoblar bazada (build vaqtida noma'lum): bitta namuna yo'l oldindan quriladi (prerender uchun
 * parametr kerak), haqiqiy kitoblar birinchi so'rovda quriladi va keshlanadi. Mavjud bo'lmagan
 * kitob uchun 404/308 holatini `proxy.ts` beradi (sahifa kontenti streaming bilan keladi).
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
  // OG rasm: 600px muqova (3:4); muqova yo'q bo'lsa saytning umumiy rasmi.
  const cover = book.cover_large ?? book.cover;
  const images = cover ? [{ url: cover, width: 600, height: 800, alt: title }] : OG_IMAGES;
  return {
    title: pageTitle,
    description,
    alternates: getAlternates(locale, pdfBookPath(book)),
    openGraph: { title: pageTitle, description, type: "book", images },
    twitter: { card: cover ? "summary_large_image" : "summary", title: pageTitle, description },
    ...(book.unverified ? { robots: { index: false, follow: true } } : {}),
  };
}

type Props = PageProps<"/[locale]/darsliklar/[sinf]/[slug]">;

/** `params` faqat `<Suspense>` ichidagi `BookContent` da o'qiladi (App Shell bitta kitobga bog'lanmasin). */
export default function BookPage({ params }: Props) {
  return (
    <Suspense fallback={<BookPageSkeleton />}>
      <BookContent params={params} />
    </Suspense>
  );
}

async function BookContent({ params }: Pick<Props, "params">) {
  const { locale, sinf, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const grade = parseGradeParam(sinf);
  if (grade === null) notFound();
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  if (!book) notFound();
  // Kitob boshqa sinfga ko'chirilgan bo'lsa (slug barqaror): to'g'ri manzilga doimiy yo'naltiriladi.
  if (book.grade !== grade) permanentRedirect(`/${locale}${pdfBookPath(book)}`);

  const [t, tn, gradeBooks, subjectBooks] = await Promise.all([
    getTranslations({ locale, namespace: "pdfBooks.page" }),
    getTranslations({ locale, namespace: "nav" }),
    getGradeBooks(grade),
    getSubjectBooks(book.subject),
  ]);
  const title = getLocalized(book.title, locale);
  const subjectTitle = getLocalized(book.subject_title, locale);
  const gradeLabel = (await getTranslations({ locale, namespace: "site" }))("gradeLabel", {
    grade,
  });
  // Mundarija tuzilmasi serverda (statik); o'qish holati klient komponentlarida qoplanadi.
  const contents = buildBookContents(book.chapters ?? [], book.page_count);
  const bookRef = { grade: book.grade, slug: book.slug };

  return (
    <>
      {!book.unverified && <RecordRecentBook book={toRecent(book)} />}

      <BookHero
        book={book}
        breadcrumbs={[
          { label: tn("home"), href: ROUTES.home },
          { label: tn("textbooks"), href: ROUTES.textbooks },
          { label: gradeLabel, href: gradePath(grade) },
          { label: title },
        ]}
        actions={
          <div className="flex flex-col gap-3">
            {/* useQuery (progress, saqlanganlar) Suspense talab qiladi; fallback — oddiy "O'qish" havolasi. */}
            <Suspense fallback={<BookActionsFallback grade={book.grade} slug={book.slug} />}>
              <BookActions
                id={book.id}
                grade={book.grade}
                slug={book.slug}
                title={title}
                pageCount={book.page_count}
                allowDownload={book.allow_download}
              >
                <BookSaveButton bookId={book.id} />
              </BookActions>
            </Suspense>
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
        }
      />

      <div className="max-w-site mx-auto flex w-full flex-col gap-[4.5rem] px-4 pt-14 pb-16 sm:px-8 md:pb-24">
        {/* ≥1024px: ikki ustun (asosiy + 368px o'ng ustun), kichikda bitta ustun. */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-10">
            {book.description.trim() && (
              <section aria-labelledby="book-description" className="flex flex-col gap-3">
                <h2 id="book-description" className={sectionHeading}>
                  {t("description")}
                </h2>
                <p className="text-muted max-w-prose whitespace-pre-line">{book.description}</p>
              </section>
            )}
            <div className="flex flex-col gap-6">
              {/* Mobilda "Davom ettirish" mundarija tepasida; desktop'da o'ng ustunda. */}
              <ContentsResumeCard
                bookId={book.id}
                book={bookRef}
                contents={contents}
                className="lg:hidden"
              />
              <BookContents bookId={book.id} book={bookRef} contents={contents} />
            </div>
          </div>
          {/* O'ng ustun ekranda qoladi; juda baland bo'lsa ichida suriladi. */}
          <aside
            data-testid="book-aside"
            className="flex min-w-0 flex-col gap-6 self-start lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
          >
            <ContentsResumeCard
              bookId={book.id}
              book={bookRef}
              contents={contents}
              className="hidden lg:flex"
            />
            <ChapterMastery bookId={book.id} contents={contents} />
            <ReportErrorLink topicId={book.id} card />
            <div className="hidden md:block">
              <SameGradeList current={book} gradeBooks={gradeBooks} />
            </div>
            <OtherGrades current={book} subjectBooks={subjectBooks} subjectTitle={subjectTitle} />
          </aside>
        </div>

        <BookPreview bookId={book.id} pageCount={book.page_count} />
        {/* Desktop'da shu sinf kitoblari o'ng ustunda; mobilda — kartalar to'ri. */}
        <div className="md:hidden">
          <SimilarBooks current={book} gradeBooks={gradeBooks} />
        </div>
      </div>

      <Suspense fallback={<BookStickyBarFallback grade={book.grade} slug={book.slug} />}>
        <BookStickyBar
          bookId={book.id}
          grade={book.grade}
          slug={book.slug}
          pageCount={book.page_count}
        />
      </Suspense>

      <JsonLd
        data={breadcrumbList(SITE_URL, locale, [
          { name: tn("home"), path: ROUTES.home },
          { name: tn("textbooks"), path: ROUTES.textbooks },
          { name: gradeLabel, path: gradePath(grade) },
          { name: title, path: pdfBookPath(book) },
        ])}
      />
      <JsonLd
        data={bookJsonLd(SITE_URL, locale, book, subjectTitle, book.cover_large ?? book.cover)}
      />
    </>
  );
}
