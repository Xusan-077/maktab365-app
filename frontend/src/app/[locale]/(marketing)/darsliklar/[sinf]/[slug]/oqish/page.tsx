import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MARKETING_CONTAINER } from "@/components/layout/containers";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PdfReaderLoader } from "@/components/pdf/PdfReaderLoader";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { parseGradeParam } from "@/lib/pdf/grade-groups";
import { getBookBySlug } from "@/lib/pdf-books/server";
import { readerPath } from "@/lib/utils/routes";

/**
 * Kitoblar bazada (build vaqtida noma'lum): bitta namuna yo'l oldindan quriladi (prerender uchun
 * parametr kerak), haqiqiy kitoblar birinchi so'rovda quriladi va keshlanadi.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, sinf: "9", slug: "namuna" }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/darsliklar/[sinf]/[slug]/oqish">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, book] = await Promise.all([
    getTranslations({ locale, namespace: "pdfBooks.meta" }),
    getBookBySlug(slug),
  ]);
  // O'qish oynasi qidiruv indeksiga kirmaydi: indekslanadigan sahifa — kitob sahifasi.
  return {
    title: book ? getLocalized(book.title, locale) : t("readerTitle"),
    robots: { index: false, follow: true },
  };
}

type Props = PageProps<"/[locale]/darsliklar/[sinf]/[slug]/oqish">;

/** `params` faqat `<Suspense>` ichidagi `ReaderContent` da o'qiladi (App Shell bitta kitobga bog'lanmasin). */
export default function PdfReaderPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className={`${MARKETING_CONTAINER} py-4`}>
          <PageSkeleton variant="reading" />
        </div>
      }
    >
      <ReaderContent params={params} />
    </Suspense>
  );
}

async function ReaderContent({ params }: Pick<Props, "params">) {
  const { locale, sinf, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const grade = parseGradeParam(sinf);
  if (grade === null) notFound();
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  // Nashr qilinmagan (qoralama) kitobni staff mijozda ochadi; boshqalarga "topilmadi" ko'rinadi.
  if (!book) {
    return (
      <div className={`${MARKETING_CONTAINER} py-4`}>
        <PdfReaderLoader slug={slug} />
      </div>
    );
  }
  if (book.grade !== grade) permanentRedirect(`/${locale}${readerPath(book)}`);
  return (
    <div className={`${MARKETING_CONTAINER} py-4`}>
      <PdfReaderLoader bookId={book.id} />
    </div>
  );
}
